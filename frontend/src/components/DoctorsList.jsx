import { useMemo, useState } from "react";
import { Calendar, Clock, Stethoscope } from "lucide-react";

export function DoctorsList({ doctors, highlightedDoctorId }) {
  const dates = useMemo(() => {
    const allDates = new Set();
    doctors.forEach((doc) => {
      Object.keys(doc.slots || {}).forEach((d) => allDates.add(d));
    });
    return Array.from(allDates).sort();
  }, [doctors]);

  const [selectedDate, setSelectedDate] = useState("all");

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Stethoscope className="h-4 w-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Doctors & Available Slots
          </h2>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSelectedDate("all")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              selectedDate === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Dates
          </button>
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                selectedDate === d
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {doctors.map((doctor) => {
          const isHighlighted = highlightedDoctorId === doctor.id;
          const slotEntries = Object.entries(doctor.slots || {}).filter(
            ([date]) => selectedDate === "all" || date === selectedDate
          );

          return (
            <div
              key={doctor.id}
              className={`px-5 py-4 transition-colors ${
                isHighlighted ? "animate-row-flash" : ""
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {doctor.name}
                  </h3>
                  <p className="text-xs text-slate-500">{doctor.speciality}</p>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {slotEntries.reduce((acc, [, list]) => acc + list.length, 0)} open
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {slotEntries.map(([date, slots]) => (
                  <div key={date} className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-w-[98px] items-center gap-1.5 text-xs font-medium text-slate-500">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {date}
                    </span>
                    {slots.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {slots.map((slot) => (
                          <span
                            key={`${date}-${slot}`}
                            className="inline-flex items-center gap-1 rounded-md border border-teal-200/80 bg-teal-50/70 px-2 py-0.5 text-xs font-medium text-teal-800"
                          >
                            <Clock className="h-3 w-3 text-teal-600" />
                            {slot}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No slots left</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
