"use client";

// Voice-to-text dictation, reusable across the app. Wraps the browser-native
// Web Speech API (no backend, no audio leaves the device's speech engine beyond
// the browser's own transcription). Renders a mic button; while listening it
// streams final transcript chunks to `onTranscript`, which the host appends to
// its field. On a browser without SpeechRecognition it renders nothing, so
// callers can drop it in anywhere without a capability check.

import { useEffect, useRef, useState } from "react";

// Minimal typings — SpeechRecognition isn't in the standard DOM lib everywhere.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceInput({
  onTranscript,
  disabled = false,
  lang = "en-US",
  className = "",
  title = "Dictate",
}: {
  /** Called with each finalized transcript chunk to append to the field. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  lang?: string;
  className?: string;
  title?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() != null);
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          if (text) onTranscript(text);
        }
      }
    };
    rec.onerror = () => stop();
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stop() {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop dictation" : title}
      title={listening ? "Stop dictation" : title}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
        listening
          ? "animate-pulse border-danger bg-danger/15 text-danger"
          : "border-border bg-surface text-muted hover:border-hmd-teal-600 hover:text-foreground"
      } ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="17" x2="12" y2="22" />
      </svg>
    </button>
  );
}
