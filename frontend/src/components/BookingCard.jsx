import { Calendar, CheckCircle2, Clock, Phone, XCircle } from "lucide-react";

export function BookingCard({ event }) {
  if (!event) return null;

  const isBooked = event.type === "appointment_booked";
  const appt = event.appointment;
  if (!appt) return null;

  return (
    <div
      className={`rounded-xl border p-3 text-xs transition-all ${
        isBooked
          ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-100"
          : "border-rose-500/40 bg-rose-950/60 text-rose-100"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {isBooked ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <XCircle className="h-4 w-4 text-rose-400" />
        )}
        <span>{isBooked ? "Appointment Confirmed" : "Appointment Cancelled"}</span>
      </div>

      <div className="mt-2 space-y-1 text-[11px] text-slate-300">
        <p className="font-medium text-white">
          {appt.doctor_name} · {appt.speciality}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3 text-slate-400" />
            {appt.date}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" />
            {appt.slot}
          </span>
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3 text-slate-400" />
            {appt.phone_number}
          </span>
        </div>
      </div>
    </div>
  );
}
