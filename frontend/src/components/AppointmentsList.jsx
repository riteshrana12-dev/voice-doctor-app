import { CalendarCheck2, Clock, Phone, Trash2 } from "lucide-react";

export function AppointmentsList({
  appointments,
  highlightedAppointmentId,
  onCancel,
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <CalendarCheck2 className="h-4 w-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-900">Appointments</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {appointments.length}
        </span>
      </div>

      {appointments.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-600">No appointments yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Start a voice call and book a slot by phone number.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {appointments.map((appt) => {
            const isHighlighted = highlightedAppointmentId === appt.id;
            return (
              <div
                key={appt.id}
                className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors ${
                  isHighlighted ? "animate-row-flash" : ""
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {appt.doctor_name}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {appt.speciality}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-teal-600" />
                      {appt.phone_number}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {appt.date} · {appt.slot}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onCancel(appt.id)}
                  title="Cancel appointment"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
