import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import {
  CHAT_VOICE_MAX_SECONDS,
  formatVoiceDuration,
  startVoiceRecording,
  type VoiceRecordingSession,
} from '../../lib/chatVoice';

interface ChatVoiceRecordButtonProps {
  disabled?: boolean;
  onRecorded: (blob: Blob, durationMs: number) => Promise<void>;
  onError: (msg: string) => void;
  onRecordingChange?: (recording: boolean) => void;
  className?: string;
}

export function ChatVoiceRecordButton({
  disabled,
  onRecorded,
  onError,
  onRecordingChange,
  className = '',
}: ChatVoiceRecordButtonProps) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const sessionRef = useRef<VoiceRecordingSession | null>(null);
  const tickRef = useRef<number | undefined>(undefined);
  const startedAtRef = useRef(0);

  useEffect(() => {
    return () => {
      sessionRef.current?.cancel();
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  async function begin() {
    if (disabled || recording) return;
    try {
      const session = await startVoiceRecording();
      sessionRef.current = session;
      startedAtRef.current = Date.now();
      setRecording(true);
      setElapsedMs(0);
      onRecordingChange?.(true);
      tickRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Brak dostępu do mikrofonu');
    }
  }

  async function finish(send: boolean) {
    if (!recording) return;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = undefined;
    }
    setRecording(false);
    setElapsedMs(0);
    onRecordingChange?.(false);

    if (!session) return;
    if (!send) {
      session.cancel();
      return;
    }
    try {
      const { blob, durationMs } = await session.stop();
      await onRecorded(blob, durationMs);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Nie udało się nagrać');
    }
  }

  if (recording) {
    return (
      <div
        className={`flex flex-1 items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-2 py-1 ${className}`}
      >
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-500" />
        <span className="min-w-0 flex-1 text-xs tabular-nums text-rose-700 dark:text-rose-200">
          {formatVoiceDuration(elapsedMs)} / {CHAT_VOICE_MAX_SECONDS}s
        </span>
        <button
          type="button"
          onClick={() => void finish(false)}
          className="rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={() => void finish(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-500"
          aria-label="Wyślij głosówkę"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void begin()}
      className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      aria-label="Nagraj głosówkę"
      title="Głosówka (max 60 s)"
    >
      <Mic className="h-5 w-5" />
    </button>
  );
}
