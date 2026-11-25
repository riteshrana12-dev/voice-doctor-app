import { useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, Stethoscope, Volume2, X } from "lucide-react";
import { AudioWaveform } from "./AudioWaveform";
import { BookingCard } from "./BookingCard";
import { useAudioWaveform } from "../hooks/useAudioWaveform";

function formatTimer(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function PhoneCallModal({
  isOpen,
  callState,
  elapsedSeconds,
  isMuted,
  messages,
  lastBookingEvent,
  errorMessage,
  localStream,
  remoteStream,
  onToggleMute,
  onEndCall,
  onReplay,
  onClose,
}) {
  const transcriptEndRef = useRef(null);
  const activeStream = remoteStream || localStream;
  const levels = useAudioWaveform(activeStream, callState === "connected");

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, lastBookingEvent]);

  if (!isOpen) return null;

  const isLive = callState === "connected";
  const isRinging = callState === "connecting" || callState === "ringing";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="flex h-[88vh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border border-slate-800 bg-slate-950 text-white shadow-2xl transition-all sm:h-[640px] sm:rounded-3xl">
        {/* Top phone bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/20 text-teal-400 ${
                isRinging ? "animate-pulse" : ""
              }`}
            >
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">MedVoice Assistant</p>
              <p className="text-xs text-slate-400">
                {callState === "connecting" && "Connecting..."}
                {callState === "ringing" && "Ringing..."}
                {callState === "connected" && formatTimer(elapsedSeconds)}
                {callState === "ended" && "Call ended"}
                {callState === "error" && "Connection failed"}
              </p>
            </div>
          </div>

          {(callState === "ended" || callState === "error") && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Close call screen"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Waveform */}
        <div className="px-5 pt-4">
          <AudioWaveform
            levels={levels}
            active={isLive}
            muted={isMuted}
          />
          {errorMessage && (
            <p className="mt-2 rounded-lg bg-rose-950/80 px-3 py-2 text-xs text-rose-200">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Live transcript & booking card inside phone */}
        <div className="scrollbar-hidden flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {lastBookingEvent && <BookingCard event={lastBookingEvent} />}

          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <p className="max-w-[220px] text-xs leading-relaxed text-slate-400">
                {isRinging
                  ? "Establishing WebRTC audio channel..."
                  : "Speak naturally. Say your phone number when ready to book or cancel."}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-800/90 text-slate-100"
                  }`}
                >
                  {msg.text}
                  {msg.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => onReplay?.(msg.text)}
                      className="ml-2 inline-flex align-middle text-teal-300 hover:text-white"
                      aria-label="Play assistant response"
                      title="Play response"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Bottom call controls */}
        <div className="border-t border-slate-800/80 bg-slate-900/60 px-6 py-5">
          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={onToggleMute}
              disabled={!isLive}
              className={`flex h-12 w-12 items-center justify-center rounded-full border transition disabled:opacity-40 ${
                isMuted
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                  : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            <button
              type="button"
              onClick={callState === "ended" || callState === "error" ? onClose : onEndCall}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-500 active:scale-95"
              aria-label="End call"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
