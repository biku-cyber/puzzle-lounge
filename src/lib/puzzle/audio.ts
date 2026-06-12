// Tiny WebAudio sound bank — no external assets.
import { PuzzleStore } from "./store";

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    } catch { return null; }
  }
  return ctx;
}

function tone(freq: number, durMs: number, type: OscillatorType = "sine", vol = 0.3) {
  const s = PuzzleStore.get().settings;
  if (!s.sound) return;
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const v = vol * s.volume;
  gain.gain.setValueAtTime(0, a.currentTime);
  gain.gain.linearRampToValueAtTime(v, a.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + durMs / 1000);
  osc.connect(gain).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + durMs / 1000);
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  const s = PuzzleStore.get().settings;
  if (!s.vibration) return;
  try { navigator.vibrate?.(pattern); } catch {/* */}
}

export const Sfx = {
  click() { tone(560, 60, "triangle", 0.18); vibrate(8); },
  move() { tone(420, 50, "sine", 0.15); },
  success() {
    tone(660, 120, "sine", 0.25);
    setTimeout(() => tone(880, 180, "sine", 0.22), 110);
    setTimeout(() => tone(1320, 260, "sine", 0.18), 260);
    vibrate([20, 40, 30]);
  },
  achievement() {
    tone(523, 140, "triangle", 0.25);
    setTimeout(() => tone(659, 140, "triangle", 0.25), 130);
    setTimeout(() => tone(784, 240, "triangle", 0.25), 260);
    setTimeout(() => tone(1047, 360, "sine", 0.22), 420);
    vibrate([30, 30, 60]);
  },
  levelUp() {
    tone(440, 120, "sine", 0.22);
    setTimeout(() => tone(660, 160, "sine", 0.22), 110);
    setTimeout(() => tone(990, 240, "triangle", 0.22), 290);
  },
  fail() { tone(220, 200, "sawtooth", 0.18); vibrate(40); },
};
