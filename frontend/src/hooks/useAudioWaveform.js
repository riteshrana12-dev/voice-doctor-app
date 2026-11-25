import { useEffect, useState } from "react";

const BAR_COUNT = 28;
const IDLE_LEVELS = Array.from({ length: BAR_COUNT }, () => 0.12);

export function useAudioWaveform(stream, isActive) {
  const [levels, setLevels] = useState(IDLE_LEVELS);

  useEffect(() => {
    if (!stream || !isActive) {
      setLevels(IDLE_LEVELS);
      return undefined;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return undefined;

    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.78;

    let source;
    try {
      source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
    } catch {
      ctx.close().catch(() => {});
      return undefined;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const bin = data[i % data.length] || 0;
        return Math.max(0.12, Math.min(1, bin / 200));
      });
      setLevels(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      try {
        source.disconnect();
      } catch {
        // Ignore disconnect errors on ended tracks
      }
      ctx.close().catch(() => {});
    };
  }, [stream, isActive]);

  return levels;
}
