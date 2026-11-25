import { useEffect, useRef } from "react";
import { MessageSquare, User, Bot } from "lucide-react";

export function TranscriptPanel({ messages, callState }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section className="flex h-[560px] flex-col rounded-2xl border border-slate-200/80 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-4 w-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Live Transcript
          </h2>
        </div>
        <span className="text-xs font-medium capitalize text-slate-500">
          {callState === "idle" ? "Ready" : callState}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-600">
              No active transcript
            </p>
            <p className="mt-1 max-w-xs text-xs text-slate-400">
              Click Try Call to speak with the scheduling assistant over WebRTC.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    isUser
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200/80 bg-slate-50 text-slate-800"
                  }`}
                >
                  <p>{msg.text}</p>
                  <span
                    className={`mt-1 block text-[10px] ${
                      isUser ? "text-slate-400" : "text-slate-400"
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>

                {isUser && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
