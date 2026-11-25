import { useCallback, useEffect, useRef, useState } from "react";
import { sendWebRTCOffer } from "../services/api";
import { playEndCallTone, playRingPulse } from "../utils/callSounds";
import { speakText, stopSpeaking } from "../utils/speech";

function waitForIceGathering(pc, timeoutMs = 1200) {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onStateChange);
  });
}

export function useWebRTCCall({ onDashboardSync }) {
  const [callState, setCallState] = useState("idle");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [messages, setMessages] = useState([]);
  const [lastBookingEvent, setLastBookingEvent] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const ringRef = useRef(null);
  const stateRef = useRef("idle");
  const assistantSpeakingRef = useRef(false);
  const userMutedRef = useRef(false);
  const speechRunRef = useRef(0);

  const updateState = useCallback((next) => {
    stateRef.current = next;
    setCallState(next);
  }, []);

  const stopTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (ringRef.current) {
      clearInterval(ringRef.current);
      ringRef.current = null;
    }
  }, []);

  const setAssistantSpeaking = useCallback((speaking) => {
    assistantSpeakingRef.current = speaking;
    setIsAssistantSpeaking(speaking);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !speaking && !userMutedRef.current;
    });
  }, []);

  const speakAssistant = useCallback((text) => {
    const runId = ++speechRunRef.current;
    setAssistantSpeaking(true);
    speakText(text, {
      onError: (message) => setErrorMessage(message),
      onEnd: () => {
        if (speechRunRef.current === runId) setAssistantSpeaking(false);
      },
    });
  }, [setAssistantSpeaking]);

  const cleanupPeer = useCallback(() => {
    stopTimers();
    speechRunRef.current += 1;
    assistantSpeakingRef.current = false;
    setIsAssistantSpeaking(false);
    stopSpeaking();
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  }, [stopTimers]);

  const endCall = useCallback(() => {
    if (stateRef.current === "ended" || stateRef.current === "idle") {
      return;
    }
    cleanupPeer();
    playEndCallTone();
    updateState("ended");
  }, [cleanupPeer, updateState]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    if (stateRef.current === "ended" || stateRef.current === "error") {
      updateState("idle");
    }
  }, [updateState]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    userMutedRef.current = nextMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted && !assistantSpeakingRef.current;
    });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const startCall = useCallback(async () => {
    cleanupPeer();
    setMessages([]);
    setLastBookingEvent(null);
    setErrorMessage("");
    setElapsedSeconds(0);
    setIsMuted(false);
    userMutedRef.current = false;
    setIsModalOpen(true);
    updateState("connecting");
    setAssistantSpeaking(false);

    // Start speech during the call button's user gesture so browsers that
    // restrict autoplay allow later assistant replies to be spoken.
    speakAssistant("MedVoice is connecting.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !assistantSpeakingRef.current && !userMutedRef.current;
      });
      setLocalStream(stream);
      updateState("ringing");
      playRingPulse();
      ringRef.current = setInterval(playRingPulse, 2400);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      const dc = pc.createDataChannel("events", { ordered: true });
      dcRef.current = dc;

      dc.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "transcript" && payload.text) {
            setMessages((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                role: payload.role,
                text: payload.text,
                time: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ]);
            if (payload.role === "assistant") {
              speakAssistant(payload.text);
            }
          } else if (
            payload.type === "appointment_booked" ||
            payload.type === "appointment_cancelled"
          ) {
            setLastBookingEvent(payload);
            onDashboardSync?.(payload);
          } else if (payload.type === "error") {
            setErrorMessage(payload.message || "Voice pipeline error.");
            cleanupPeer();
            updateState("error");
          }
        } catch {
          // Ignore non-JSON channel messages
        }
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const remote = event.streams[0] || new MediaStream([event.track]);
        setRemoteStream(remote);
        if (audioRef.current) {
          audioRef.current.srcObject = remote;
          audioRef.current.play().catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          stopTimers();
          updateState("connected");
          timerRef.current = setInterval(() => {
            setElapsedSeconds((sec) => sec + 1);
          }, 1000);
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          if (stateRef.current !== "ended" && stateRef.current !== "idle") {
            endCall();
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const answer = await sendWebRTCOffer({
        sdp: pc.localDescription.sdp,
        type: pc.localDescription.type,
      });

      await pc.setRemoteDescription(
        new RTCSessionDescription({ sdp: answer.sdp, type: answer.type })
      );
    } catch (err) {
      cleanupPeer();
      setErrorMessage(err?.message || "Could not start WebRTC call.");
      updateState("error");
    }
  }, [cleanupPeer, endCall, onDashboardSync, setAssistantSpeaking, speakAssistant, stopTimers, updateState]);

  useEffect(() => () => cleanupPeer(), [cleanupPeer]);

  return {
    audioRef,
    callState,
    isModalOpen,
    isMuted: isMuted || isAssistantSpeaking,
    elapsedSeconds,
    messages,
    lastBookingEvent,
    errorMessage,
    localStream,
    remoteStream,
    startCall,
    endCall,
    speakAssistant,
    toggleMute,
    closeModal,
  };
}
