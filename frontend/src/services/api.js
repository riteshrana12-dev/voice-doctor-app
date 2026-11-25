const API_BASE = "/api";

export async function fetchDashboardState() {
  const res = await fetch(`${API_BASE}/dashboard`);
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard state (${res.status})`);
  }
  return res.json();
}

export async function sendWebRTCOffer({ sdp, type }) {
  const res = await fetch(`${API_BASE}/offer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp, type }),
  });
  if (!res.ok) {
    let message = `Signaling error (${res.status})`;
    const errText = await res.text();
    try {
      const payload = JSON.parse(errText);
      message = payload.detail || message;
    } catch {
      if (errText) message = errText;
    }
    throw new Error(message);
  }
  return res.json();
}

export async function cancelAppointmentById(appointmentId) {
  const res = await fetch(`${API_BASE}/appointments/${appointmentId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to cancel appointment (${res.status})`);
  }
  return res.json();
}

export function subscribeToDashboardEvents(onEvent) {
  const source = new EventSource(`${API_BASE}/events`);
  source.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onEvent(parsed);
    } catch {
      // Ignore malformed heartbeat payloads
    }
  };
  return () => source.close();
}
