import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from loguru import logger
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

from . import storage
from .pipeline import keys_are_configured, run_voice_pipeline

webrtc_handler = SmallWebRTCRequestHandler()
background_tasks: set[asyncio.Task] = set()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await webrtc_handler.close()
    for task in list(background_tasks):
        task.cancel()


app = FastAPI(title="MedVoice Appointment API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "keys_configured": keys_are_configured(),
    }


@app.get("/api/dashboard")
def get_dashboard():
    return {
        "doctors": storage.get_doctors_with_availability(),
        "appointments": storage.get_appointments(),
    }


@app.delete("/api/appointments/{appointment_id}")
def delete_appointment(appointment_id: str):
    appointments = storage.get_appointments()
    target = next((a for a in appointments if a["id"] == appointment_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Appointment not found")
    result = storage.cancel_appointment(
        phone_number=target["phone_number"],
        doctor_name=target["doctor_name"],
        date=target["date"],
        slot=target["slot"],
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("message", "Cancel failed"))
    return result


@app.get("/api/events")
async def sse_events(request: Request):
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def on_change(event: dict) -> None:
        payload = {
            "event": event,
            "doctors": storage.get_doctors_with_availability(),
            "appointments": storage.get_appointments(),
        }
        loop.call_soon_threadsafe(queue.put_nowait, payload)

    storage.add_change_listener(on_change)

    async def event_stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            storage.remove_change_listener(on_change)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/offer")
async def offer(request: SmallWebRTCRequest):
    async def on_connection(webrtc_connection: SmallWebRTCConnection) -> None:
        task = asyncio.create_task(run_voice_pipeline(webrtc_connection))
        background_tasks.add(task)
        task.add_done_callback(background_tasks.discard)

    try:
        answer = await webrtc_handler.handle_web_request(
            request=request,
            webrtc_connection_callback=on_connection,
        )
        return answer
    except Exception as exc:
        logger.exception(f"WebRTC signaling failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
