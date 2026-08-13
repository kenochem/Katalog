import { isTalkChatSoundsEnabled } from './talkChatAppearance';

let audioCtx: AudioContext | null = null;

interface ChimeNote {
  freq: number;
  at: number;
  length: number;
  volume: number;
}

/** Miękki dzwonek nowej wiadomości (Web Audio). */
export function playChatNotification() {
  try {
    if (typeof window === 'undefined') return;
    if (!isTalkChatSoundsEnabled()) return;
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.085, t + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(1400, t + 0.9);
    filter.Q.setValueAtTime(0.6, t);
    filter.connect(master);

    const notes: ChimeNote[] = [
      { freq: 880, at: 0, length: 0.42, volume: 0.55 },
      { freq: 1108.73, at: 0.16, length: 0.48, volume: 0.5 },
      { freq: 1318.51, at: 0.32, length: 0.62, volume: 0.45 },
    ];

    for (const note of notes) {
      const start = t + note.at;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, start);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(note.volume, start + 0.028);
      env.gain.exponentialRampToValueAtTime(0.0001, start + note.length);
      osc.connect(env);
      env.connect(filter);
      osc.start(start);
      osc.stop(start + note.length + 0.06);
    }
  } catch {
    /* autoplay policy */
  }
}

/** Dźwięk wysłania wiadomości. */
export function playChatSendSound() {
  try {
    if (typeof window === 'undefined') return;
    if (!isTalkChatSoundsEnabled()) return;
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    const duration = 0.26;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(750, t + duration * 0.85);
    filter.connect(master);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(560, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + duration * 0.72);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.55, t + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.78);
    osc.connect(env);
    env.connect(filter);
    osc.start(t);
    osc.stop(t + duration);
  } catch {
    /* ignore */
  }
}
