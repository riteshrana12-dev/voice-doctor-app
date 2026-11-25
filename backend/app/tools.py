from typing import Any, Awaitable, Callable

from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams

from . import storage

check_doctor_availability_schema = FunctionSchema(
    name="check_doctor_availability",
    description=(
        "Check available appointment slots for a doctor or speciality on a given date, "
        "or list all doctors and their open slots."
    ),
    properties={
        "doctor_name": {
            "type": "string",
            "description": "Doctor name (e.g. 'Dr. Sarah Chen') or speciality (e.g. 'Cardiologist'). Leave empty to list all doctors.",
        },
        "date": {
            "type": "string",
            "description": "Optional date in YYYY-MM-DD format (e.g. '2026-12-15').",
        },
    },
    required=[],
)

book_appointment_schema = FunctionSchema(
    name="book_appointment",
    description=(
        "Book an available doctor appointment only after the caller has explicitly confirmed "
        "their phone number. Set phone_confirmed to true only after that confirmation."
    ),
    properties={
        "phone_number": {
            "type": "string",
            "description": "Caller's spoken and confirmed phone number.",
        },
        "phone_confirmed": {
            "type": "boolean",
            "description": "True only after the caller explicitly confirms the number read back to them.",
        },
        "doctor_name": {
            "type": "string",
            "description": "Full name of the doctor (e.g. 'Dr. Sarah Chen').",
        },
        "date": {
            "type": "string",
            "description": "Appointment date in YYYY-MM-DD format.",
        },
        "slot": {
            "type": "string",
            "description": "Appointment time slot in HH:MM 24-hour format (e.g. '10:00', '14:30').",
        },
    },
    required=["phone_number", "phone_confirmed", "doctor_name", "date", "slot"],
)

cancel_appointment_schema = FunctionSchema(
    name="cancel_appointment",
    description=(
        "Cancel the caller's appointment after they explicitly confirm their phone number. "
        "Set phone_confirmed to true only after the caller confirms the number read back to them. "
        "Each phone number should have one active appointment; optionally provide appointment details to disambiguate legacy records."
    ),
    properties={
        "phone_number": {
            "type": "string",
            "description": "Caller's spoken and confirmed phone number.",
        },
        "phone_confirmed": {
            "type": "boolean",
            "description": "True only after the caller explicitly confirms the number read back to them.",
        },
        "doctor_name": {
            "type": "string",
            "description": "Optional doctor name for disambiguating legacy records.",
        },
        "date": {
            "type": "string",
            "description": "Optional appointment date in YYYY-MM-DD format for disambiguating legacy records.",
        },
        "slot": {
            "type": "string",
            "description": "Optional appointment time in HH:MM 24-hour format for disambiguating legacy records.",
        },
    },
    required=["phone_number", "phone_confirmed"],
)

TOOLS_SCHEMA = ToolsSchema(
    standard_tools=[
        check_doctor_availability_schema,
        book_appointment_schema,
        cancel_appointment_schema,
    ]
)


def register_appointment_tools(
    llm: Any,
    notify_client: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> None:
    async def handle_check_availability(params: FunctionCallParams) -> None:
        doctor_name = params.arguments.get("doctor_name", "")
        date = params.arguments.get("date", "")
        result = storage.check_doctor_availability(doctor_name=doctor_name, date=date)
        await params.result_callback(result)

    async def handle_book_appointment(params: FunctionCallParams) -> None:
        if params.arguments.get("phone_confirmed") is not True:
            await params.result_callback({"ok": False, "message": "The caller must confirm their phone number before booking."})
            return
        phone_number = params.arguments.get("phone_number", "")
        doctor_name = params.arguments.get("doctor_name", "")
        date = params.arguments.get("date", "")
        slot = params.arguments.get("slot", "")
        result = storage.book_appointment(
            phone_number=phone_number,
            doctor_name=doctor_name,
            date=date,
            slot=slot,
        )
        if result.get("ok") and notify_client:
            await notify_client({
                "type": "appointment_booked",
                "appointment": result["appointment"],
            })
        await params.result_callback(result)

    async def handle_cancel_appointment(params: FunctionCallParams) -> None:
        if params.arguments.get("phone_confirmed") is not True:
            await params.result_callback({"ok": False, "message": "The caller must confirm their phone number before cancellation."})
            return
        phone_number = params.arguments.get("phone_number", "")
        doctor_name = params.arguments.get("doctor_name", "")
        date = params.arguments.get("date", "")
        slot = params.arguments.get("slot", "")
        result = storage.cancel_appointment(
            phone_number=phone_number,
            doctor_name=doctor_name,
            date=date,
            slot=slot,
        )
        if result.get("ok") and notify_client:
            await notify_client({
                "type": "appointment_cancelled",
                "appointment": result["cancelled_appointment"],
            })
        await params.result_callback(result)

    llm.register_function("check_doctor_availability", handle_check_availability)
    llm.register_function("book_appointment", handle_book_appointment)
    llm.register_function("cancel_appointment", handle_cancel_appointment)
