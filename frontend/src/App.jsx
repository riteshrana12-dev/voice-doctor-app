import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Header } from "./components/Header";
import { DoctorsList } from "./components/DoctorsList";
import { AppointmentsList } from "./components/AppointmentsList";
import { PhoneCallModal } from "./components/PhoneCallModal";
import { useWebRTCCall } from "./hooks/useWebRTCCall";
import {
  cancelAppointmentById,
  fetchDashboardState,
  subscribeToDashboardEvents,
} from "./services/api";

export default function App() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [keysConfigured, setKeysConfigured] = useState(true);
  const [highlightedDoctorId, setHighlightedDoctorId] = useState(null);
  const [highlightedAppointmentId, setHighlightedAppointmentId] = useState(null);

  const flashHighlight = useCallback((event) => {
    const appt = event?.appointment;
    if (!appt) return;
    setHighlightedDoctorId(appt.doctor_id);
    if (event.type === "appointment_booked") {
      setHighlightedAppointmentId(appt.id);
    }
    setTimeout(() => {
      setHighlightedDoctorId(null);
      setHighlightedAppointmentId(null);
    }, 2600);
  }, []);

  const refreshDashboard = useCallback(async (event) => {
    try {
      const [data, healthRes] = await Promise.all([
        fetchDashboardState(),
        fetch("/api/health").then((r) => (r.ok ? r.json() : null)),
      ]);
      setDoctors(data.doctors || []);
      setAppointments(data.appointments || []);
      setApiConnected(true);
      if (healthRes && typeof healthRes.keys_configured === "boolean") {
        setKeysConfigured(healthRes.keys_configured);
      }
      if (event) flashHighlight(event);
    } catch {
      setApiConnected(false);
    }
  }, [flashHighlight]);

  useEffect(() => {
    refreshDashboard();
    const unsubscribe = subscribeToDashboardEvents((payload) => {
      if (payload.doctors) setDoctors(payload.doctors);
      if (payload.appointments) setAppointments(payload.appointments);
      setApiConnected(true);
      if (payload.event) flashHighlight(payload.event);
    });
    return unsubscribe;
  }, [flashHighlight, refreshDashboard]);

  const handleManualCancel = useCallback(async (appointmentId) => {
    try {
      await cancelAppointmentById(appointmentId);
      await refreshDashboard();
    } catch {
      // Handled by next dashboard sync
    }
  }, [refreshDashboard]);

  const {
    audioRef,
    callState,
    isModalOpen,
    isMuted,
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
  } = useWebRTCCall({ onDashboardSync: refreshDashboard });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <Header
        callState={callState}
        onStartCall={startCall}
        apiConnected={apiConnected}
      />

      {apiConnected && !keysConfigured && (
        <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Add valid <code className="font-mono font-semibold">GROQ_API_KEY</code> and <code className="font-mono font-semibold">ELEVENLABS_API_KEY</code> values to <code className="font-mono">backend/.env</code>, then restart the backend.
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <DoctorsList
          doctors={doctors}
          highlightedDoctorId={highlightedDoctorId}
        />
        <AppointmentsList
          appointments={appointments}
          highlightedAppointmentId={highlightedAppointmentId}
          onCancel={handleManualCancel}
        />
      </main>

      <PhoneCallModal
        isOpen={isModalOpen}
        callState={callState}
        elapsedSeconds={elapsedSeconds}
        isMuted={isMuted}
        messages={messages}
        lastBookingEvent={lastBookingEvent}
        errorMessage={errorMessage}
        localStream={localStream}
        remoteStream={remoteStream}
        onToggleMute={toggleMute}
        onEndCall={endCall}
        onReplay={speakAssistant}
        onClose={closeModal}
      />
    </div>
  );
}
