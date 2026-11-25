import json
import re
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Callable

from .config import APPOINTMENTS_FILE, DOCTORS_FILE

_lock = threading.Lock()
_listeners: list[Callable[[dict[str, Any]], None]] = []


def add_change_listener(callback: Callable[[dict[str, Any]], None]) -> None:
    with _lock:
        if callback not in _listeners:
            _listeners.append(callback)


def remove_change_listener(callback: Callable[[dict[str, Any]], None]) -> None:
    with _lock:
        if callback in _listeners:
            _listeners.remove(callback)


def _emit_change(event: dict[str, Any]) -> None:
    with _lock:
        listeners = list(_listeners)
    for cb in listeners:
        try:
            cb(event)
        except Exception:
            pass


def normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def _read_json(path, default: dict) -> dict:
    if not path.exists():
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def get_appointments() -> list[dict[str, Any]]:
    with _lock:
        return _read_json(APPOINTMENTS_FILE, {"appointments": []}).get("appointments", [])


def get_doctors_with_availability() -> list[dict[str, Any]]:
    with _lock:
        doctors = _read_json(DOCTORS_FILE, {"doctors": []}).get("doctors", [])
        appointments = _read_json(APPOINTMENTS_FILE, {"appointments": []}).get("appointments", [])

    booked_set = {
        (appt["doctor_id"], appt["date"], _normalize_slot(appt["slot"]))
        for appt in appointments
    }

    result = []
    for doc in doctors:
        available_slots = {}
        for date, slots in doc.get("slots", {}).items():
            open_slots = [
                _format_slot(_normalize_slot(slot))
                for slot in slots
                if (doc["id"], date, _normalize_slot(slot)) not in booked_set
            ]
            available_slots[date] = open_slots
        result.append({
            "id": doc["id"],
            "name": doc["name"],
            "speciality": doc["speciality"],
            "slots": available_slots,
        })
    return result


def find_doctor(query: str) -> dict[str, Any] | None:
    if not query:
        return None

    def normalize_name(value: str) -> str:
        value = re.sub(r"\b(?:dr|doctor)\.?\b", " ", value.lower())
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", value)).strip()

    q = normalize_name(query)
    doctors = get_doctors_with_availability()
    for doc in doctors:
        name_clean = normalize_name(doc["name"])
        specialty_clean = normalize_name(doc["speciality"])
        if name_clean == q or name_clean in q or q in name_clean:
            return doc
        if q == specialty_clean or specialty_clean in q:
            return doc
    return None


def _normalize_slot(slot: str) -> str:
    cleaned = (slot or "").strip().lower().replace(" ", "")
    match = re.match(r"^(\d{1,2}):?(\d{2})?(am|pm)?$", cleaned)
    if not match:
        return (slot or "").strip()
    hour = int(match.group(1))
    minute = int(match.group(2) or "00")
    ampm = match.group(3)
    if ampm == "pm" and hour < 12:
        hour += 12
    elif ampm == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _format_slot(slot: str) -> str:
    try:
        hour, minute = (int(part) for part in slot.split(":"))
    except (AttributeError, TypeError, ValueError):
        return slot
    period = "AM" if hour < 12 else "PM"
    display_hour = hour % 12 or 12
    return f"{display_hour}:{minute:02d} {period}"


def check_doctor_availability(doctor_name: str = "", date: str = "") -> dict[str, Any]:
    doctors = get_doctors_with_availability()
    if not doctor_name:
        return {
            "ok": True,
            "doctors": [
                {
                    "name": d["name"],
                    "speciality": d["speciality"],
                    "slots": {date: d["slots"].get(date, [])} if date else d["slots"],
                }
                for d in doctors
            ],
        }

    doctor = find_doctor(doctor_name)
    if not doctor:
        return {
            "ok": False,
            "message": f"Doctor '{doctor_name}' was not found.",
            "available_doctors": [f"{d['name']} ({d['speciality']})" for d in doctors],
        }

    slots = doctor["slots"]
    if date:
        date_slots = slots.get(date, [])
        return {
            "ok": True,
            "doctor": doctor["name"],
            "speciality": doctor["speciality"],
            "date": date,
            "available_slots": date_slots,
        }

    return {
        "ok": True,
        "doctor": doctor["name"],
        "speciality": doctor["speciality"],
        "slots_by_date": slots,
    }


def book_appointment(phone_number: str, doctor_name: str, date: str, slot: str) -> dict[str, Any]:
    phone_digits = normalize_phone(phone_number)
    if len(phone_digits) != 10:
        return {
            "ok": False,
            "message": "A valid phone number with exactly 10 digits is required to book.",
        }

    doctor = find_doctor(doctor_name)
    if not doctor:
        return {"ok": False, "message": f"Doctor '{doctor_name}' was not found."}

    norm_slot = _normalize_slot(slot)
    with _lock:
        doctors_data = _read_json(DOCTORS_FILE, {"doctors": []}).get("doctors", [])
        raw_doc = next((d for d in doctors_data if d["id"] == doctor["id"]), None)
        if not raw_doc or date not in raw_doc.get("slots", {}):
            return {
                "ok": False,
                "message": f"{doctor['name']} does not have a schedule on {date}.",
            }
        scheduled_slots = {_normalize_slot(value) for value in raw_doc["slots"][date]}
        if norm_slot not in scheduled_slots:
            return {
                "ok": False,
                "message": f"Slot {norm_slot} on {date} is not in {doctor['name']}'s schedule.",
            }

        appt_data = _read_json(APPOINTMENTS_FILE, {"appointments": []})
        appointments = appt_data.get("appointments", [])
        if any(a.get("phone_digits") == phone_digits for a in appointments):
            return {
                "ok": False,
                "message": "This phone number already has an active appointment. Cancel it before booking another.",
            }
        already_taken = any(
            a["doctor_id"] == doctor["id"] and a["date"] == date and a["slot"] == norm_slot
            for a in appointments
        )
        if already_taken:
            return {
                "ok": False,
                "message": f"{doctor['name']} at {norm_slot} on {date} is already booked.",
            }

        new_appt = {
            "id": str(uuid.uuid4())[:8],
            "phone_number": phone_number.strip(),
            "phone_digits": phone_digits,
            "doctor_id": doctor["id"],
            "doctor_name": doctor["name"],
            "speciality": doctor["speciality"],
            "date": date,
            "slot": norm_slot,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        appointments.append(new_appt)
        _write_json(APPOINTMENTS_FILE, {"appointments": appointments})

    _emit_change({"type": "appointment_booked", "appointment": new_appt})
    return {"ok": True, "appointment": new_appt}


def cancel_appointment(
    phone_number: str,
    doctor_name: str = "",
    date: str = "",
    slot: str = "",
) -> dict[str, Any]:
    phone_digits = normalize_phone(phone_number)
    if len(phone_digits) != 10:
        return {
            "ok": False,
            "message": "A valid phone number with exactly 10 digits is required to look up your appointment.",
        }
    doctor = find_doctor(doctor_name) if doctor_name else None
    if doctor_name and not doctor:
        return {"ok": False, "message": f"Doctor '{doctor_name}' was not found."}

    with _lock:
        appt_data = _read_json(APPOINTMENTS_FILE, {"appointments": []})
        appointments = appt_data.get("appointments", [])

        matches = [a for a in appointments if a.get("phone_digits") == phone_digits]
        if doctor:
            matches = [a for a in matches if a.get("doctor_id") == doctor["id"]]
        if date:
            matches = [a for a in matches if a.get("date") == date]
        if slot:
            normalized_slot = _normalize_slot(slot)
            matches = [a for a in matches if _normalize_slot(a.get("slot", "")) == normalized_slot]

        if not matches:
            return {
                "ok": False,
                "message": f"No appointment was found for phone number {phone_number} with those details.",
            }

        if len(matches) > 1:
            return {
                "ok": False,
                "message": "More than one appointment matched those details. Please contact the clinic for help.",
            }

        cancelled = matches[0]
        remaining = [a for a in appointments if a["id"] != cancelled["id"]]
        _write_json(APPOINTMENTS_FILE, {"appointments": remaining})

    _emit_change({"type": "appointment_cancelled", "appointment": cancelled})
    return {"ok": True, "cancelled_appointment": cancelled}
