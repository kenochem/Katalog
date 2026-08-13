import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { formatVoiceDuration } from '../../lib/chatVoice';

interface ChatVoicePlayerProps {
  src: string;
  durationMs: number;
}

export function ChatVoicePlayer({ src, durationMs }: ChatVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (el.duration && Number.isFinite(el.duration)) {
        setProgress(el.currentTime / el.duration);
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    el.addEventListener('pause', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('pause', onEnd);
    };
  }, [src]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  }

  const label = formatVoiceDuration(durationMs);

  return (
    <div className="talk-voice-player flex min-w-[180px] max-w-[240px] items-center gap-2 py-1">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/10 text-slate-800 dark:bg-white/15 dark:text-slate-100"
        aria-label={playing ? 'Pauza' : 'Odtwórz głosówkę'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
          <div
            className="h-full rounded-full bg-brand-600 dark:bg-brand-400"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}
