import { useRef, useState } from 'react';

export default function VoiceInputButton({ onTranscript }) {
  const [recording, setRecording] = useState(false);
  const ref = useRef(null);

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setRecording(true);
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      onTranscript?.(text);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    ref.current = recognition;
    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={startRecording}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${recording ? 'border-red-400 bg-red-500/15 text-red-300' : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-cyan-400'}`}
    >
      {recording ? 'Listening...' : 'Start Recording'}
    </button>
  );
}
