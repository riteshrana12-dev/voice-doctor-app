import { Phone, Radio, Stethoscope } from "lucide-react";

export function Header({ callState, onStartCall, apiConnected }) {
  const isBusy = callState === "connecting" || callState === "ringing" || callState === "connected";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                MedVoice Desk
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  apiConnected
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80"
                    : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80"
                }`}
              >
                <Radio className="h-3 w-3" />
                {apiConnected ? "Live" : "Offline"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Voice appointment desk
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartCall}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Phone className="h-4 w-4 text-teal-400" />
          <span>{isBusy ? "Call Active" : "Try Call"}</span>
        </button>
      </div>
    </header>
  );
}
