export function AudioWaveform({ levels, active, muted }) {
  return (
    <div
      className="flex h-11 items-center justify-center gap-1 rounded-xl bg-slate-900/70 px-3"
      aria-label="Live audio waveform"
    >
      {levels.map((level, idx) => (
        <span
          key={idx}
          className={`w-1 rounded-full transition-all duration-75 ${
            muted
              ? "bg-slate-600"
              : active
                ? "bg-teal-400"
                : "bg-slate-500"
          }`}
          style={{
            height: `${Math.round((muted ? 0.14 : level) * 32)}px`,
          }}
        />
      ))}
    </div>
  );
}
