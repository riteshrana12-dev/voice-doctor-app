import aiohttp
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.elevenlabs.stt import ElevenLabsSTTService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

from .config import (
    ELEVENLABS_API_KEY,
    GROQ_API_KEY,
    GROQ_MODEL,
)
from .tools import TOOLS_SCHEMA, register_appointment_tools


SYSTEM_PROMPT = """You are MedVoice, the front-desk voice assistant at Clinic Line.
You help callers on the phone check doctor availability, book an appointment, and cancel an appointment.

Doctors:
- Dr. Sarah Chen, General Physician
- Dr. Miguel Rodriguez, Cardiologist
- Dr. Aisha Johnson, Dermatologist
- Dr. Robert Kim, Pediatrician
- Dr. Elena Russo, Neurologist

Rules:
- Your words are spoken aloud. Use one or two short sentences, no lists or symbols, and ask one question at a time.
- Never guess slots. Use the availability tool and offer at most three options.
- The caller is known only by the phone number they say. Turn spoken digits into digits.
- Read the number back in small groups and wait for a yes before booking or cancelling. Only then set phone_confirmed to true.
- Say an appointment is booked or cancelled only after the tool reports success.
- If a tool reports an error, explain it simply and offer the next step. Do not retry unless the caller changes something.
- Each phone number can hold one appointment.
- Give no medical advice. For an emergency, tell the caller to contact local emergency services.
- Write only your single next reply, then stop and wait for the caller. Never write the caller's lines.
- Never repeat yourself, never offer several versions of a sentence, and never write stage directions or text in brackets.
- If the caller says the number is wrong, say only: Sorry about that. Please say the number again.

The examples below only show the style. In a real call you write one MedVoice line at a time.

Example of booking:
Caller: I need a skin doctor tomorrow.
MedVoice: Dr. Aisha Johnson is free tomorrow at 10:30 AM or 2 PM. Which works for you?
Caller: 2 PM.
MedVoice: Great. What is your phone number?
Caller: nine eight two zero one two three four five six.
MedVoice: I have 9 8 2 0 1, 2 3 4 5 6. Is that right?
Caller: Yes.
MedVoice: You are booked with Dr. Johnson tomorrow at 2 PM. Anything else?

Example of a wrong number:
MedVoice: I have 9 8 2 0 1, 2 3 4 5 6. Is that right?
Caller: No, that is wrong.
MedVoice: Sorry about that. Please say the number again.

Example of cancelling:
Caller: I want to cancel my appointment.
MedVoice: Sure. What phone number did you book with?
Caller: 98201 23456.
MedVoice: That is 9 8 2 0 1, 2 3 4 5 6. Correct?
Caller: Yes.
MedVoice: Done. Your 2 PM appointment with Dr. Johnson tomorrow is cancelled. Anything else?

Example of a number with no appointment:
Caller: Cancel it, my number is 9000000000.
MedVoice: That is 9 0 0 0 0, 0 0 0 0 0. Is that right?
Caller: Yes.
MedVoice: I cannot find an appointment under that number. Could you say it again?"""


def keys_are_configured() -> bool:
    return (
        bool(GROQ_API_KEY)
        and "your_groq" not in GROQ_API_KEY.lower()
        and bool(ELEVENLABS_API_KEY)
        and "your_elevenlabs" not in ELEVENLABS_API_KEY.lower()
    )


async def run_voice_pipeline(webrtc_connection: SmallWebRTCConnection) -> None:
    async def send_to_client(payload: dict) -> None:
        try:
            webrtc_connection.send_app_message(payload)
        except Exception as exc:
            logger.warning(f"Failed to send DataChannel message: {exc}")

    if not keys_are_configured():
        logger.error("Provider API keys are missing in backend/.env")
        await send_to_client({
            "type": "error",
            "message": "Voice provider API keys are missing. Add GROQ_API_KEY and ELEVENLABS_API_KEY to backend/.env, then restart the backend.",
        })
        return

    try:
        transport = SmallWebRTCTransport(
            webrtc_connection=webrtc_connection,
            params=TransportParams(
                audio_in_enabled=True,
                # The browser speaks assistant replies with its built-in voice.
                # This avoids the paid ElevenLabs library-voice TTS endpoint.
                audio_out_enabled=False,
            ),
        )

        async with aiohttp.ClientSession() as aiohttp_session:
            stt = ElevenLabsSTTService(
                api_key=ELEVENLABS_API_KEY,
                aiohttp_session=aiohttp_session,
            )
            llm = OpenAILLMService(
                api_key=GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1",
                model=GROQ_MODEL,
                settings=OpenAILLMService.Settings(
                    temperature=0.3,
                    max_completion_tokens=200,
                    extra={
                        "extra_body": {
                            "include_reasoning": False,
                            "reasoning_effort": "low",
                        },
                    },
                ),
            )
            register_appointment_tools(llm, notify_client=send_to_client)

            async def report_provider_error(provider: str, error: str) -> None:
                logger.error(f"{provider} provider connection failed: {error}")
                error_lower = error.lower()
                if "invalid_api_key" in error_lower or "api key id" in error_lower or "401" in error_lower or "unauthorized" in error_lower:
                    message = (
                        f"{provider}: authentication failed. Check the provider API key in backend/.env and restart."
                    )
                elif "rate_limit" in error_lower or "429" in error_lower:
                    message = f"{provider}: rate limit reached. Wait briefly and try again."
                else:
                    message = f"{provider} error: {error[:200]}"
                await send_to_client({"type": "error", "message": message})

            @stt.event_handler("on_connection_error")
            async def on_stt_connection_error(_service, error):
                await report_provider_error("ElevenLabs STT", str(error))

            @stt.event_handler("on_error")
            async def on_stt_error(_service, error_frame):
                details = str(getattr(error_frame, "error", error_frame))
                await report_provider_error("ElevenLabs STT", details)

            @llm.event_handler("on_error")
            async def on_llm_error(_service, error_frame):
                details = str(getattr(error_frame, "error", error_frame))
                await report_provider_error("Groq LLM", details)

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": "Greet the caller briefly and ask how you can help with a doctor appointment today.",
                },
            ]
            context = LLMContext(messages=messages, tools=TOOLS_SCHEMA)

            # In Pipecat 1.17, SileroVADAnalyzer is attached to LLMUserAggregatorParams.
            context_aggregator = LLMContextAggregatorPair(
                context,
                user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
            )

            pipeline = Pipeline([
                transport.input(),
                stt,
                context_aggregator.user(),
                llm,
                context_aggregator.assistant(),
            ])

            task = PipelineTask(
                pipeline,
                params=PipelineParams(allow_interruptions=True),
            )

            @transport.event_handler("on_client_connected")
            async def on_client_connected(_transport, _connection):
                logger.info("WebRTC caller connected")
                await task.queue_frames([LLMRunFrame()])

            @transport.event_handler("on_client_disconnected")
            async def on_client_disconnected(_transport, _connection):
                logger.info("WebRTC caller disconnected")
                await task.cancel()

            @context_aggregator.user().event_handler("on_user_turn_stopped")
            async def on_user_turn_stopped(_aggregator, _strategy, message):
                text = (getattr(message, "content", "") or "").strip()
                if text:
                    await send_to_client({
                        "type": "transcript",
                        "role": "user",
                        "text": text,
                    })

            @context_aggregator.assistant().event_handler("on_assistant_turn_stopped")
            async def on_assistant_turn_stopped(_aggregator, message):
                text = (getattr(message, "content", "") or "").strip()
                if text:
                    await send_to_client({
                        "type": "transcript",
                        "role": "assistant",
                        "text": text,
                    })

            runner = PipelineRunner(handle_sigint=False)
            await runner.run(task)

    except Exception as exc:
        error_text = str(exc)
        logger.exception(f"Voice pipeline crashed: {error_text}")
        # Surface the real error to the frontend instead of a silent crash
        if "invalid_api_key" in error_text.lower() or "api key id" in error_text.lower() or "401" in error_text.lower() or "unauthorized" in error_text.lower():
            msg = "Provider authentication failed. Check the API keys in backend/.env."
        elif "rate_limit" in error_text.lower() or "429" in error_text.lower():
            msg = "A voice provider rate limit was reached. Wait briefly and try again."
        elif "authentication" in error_text.lower() or "unauthorized" in error_text.lower():
            msg = "Authentication failed for a provider. Check your API keys in backend/.env."
        else:
            msg = f"Voice pipeline error: {error_text[:300]}"
        await send_to_client({"type": "error", "message": msg})
