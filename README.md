# MedVoice — Voice Doctor Appointment System

Real-time voice-based doctor appointment booking system built with **Pipecat** (WebRTC + Silero VAD + ElevenLabs STT + Groq), **FastAPI**, **JSON storage**, and **React + Tailwind CSS**. Assistant replies are spoken by the browser's built-in speech synthesis, so the app does not require a paid TTS voice.

## Project Structure

```
voice-doctor-app/
├── backend/
│   ├── .env                 # API key placeholders (fill in your keys)
│   ├── .env.example
│   ├── requirements.txt
│   ├── data/
│   │   ├── doctors.json     # Doctors, specialities, and base schedules
│   │   └── appointments.json
│   └── app/
│       ├── main.py          # FastAPI routes, SSE updates, WebRTC /api/offer
│       ├── pipeline.py      # Pipecat SmallWebRTC + SileroVAD + STT/LLM
│       ├── tools.py         # check_doctor_availability, book_appointment, cancel_appointment
│       ├── storage.py       # JSON persistence and slot matching
│       └── config.py        # Environment loading
└── frontend/
    └── src/
        ├── App.jsx
        ├── services/api.js
        ├── hooks/
        │   ├── useWebRTCCall.js
        │   └── useAudioWaveform.js
        └── components/
            ├── Header.jsx
            ├── DoctorsList.jsx
            ├── AppointmentsList.jsx
            ├── TranscriptPanel.jsx
            ├── PhoneCallModal.jsx
            ├── AudioWaveform.jsx
            └── BookingCard.jsx
```

## Setup & Run

1. **Add API keys** in `backend/.env`:
   - `GROQ_API_KEY`
   - `GROQ_MODEL` (defaults to `openai/gpt-oss-120b`)
   - `ELEVENLABS_API_KEY` (used for speech recognition)

2. **Start the backend**:
   ```bash
   cd backend
   source .venv/bin/activate
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Start the frontend** (in a second terminal):
   ```bash
   cd frontend
   npm run dev -- --host 0.0.0.0
   ```

4. Open `http://localhost:5173` and click **Try Call**.
