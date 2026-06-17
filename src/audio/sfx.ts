// Sound-effect hook points (§19). Implementation is a tiny Web Audio synth so the
// game has feedback without any asset loading; all calls are safe no-ops when Web
// Audio is unavailable or sound is disabled. The game loop / reducers only ever
// invoke these callbacks — they never touch the audio layer directly.

let ctx: AudioContext | null = null;
let enabled = true;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** A short tone. `type` shapes the timbre. */
function tone(freq: number, durationMs: number, type: OscillatorType = 'square', gain = 0.04): void {
  if (!enabled) return;
  const ac = audioContext();
  if (!ac) return;
  // Browsers suspend the context until a user gesture; resume opportunistically.
  if (ac.state === 'suspended') void ac.resume();

  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain;
  osc.connect(amp).connect(ac.destination);

  const now = ac.currentTime;
  const dur = durationMs / 1000;
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.start(now);
  osc.stop(now + dur);
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export const sfx = {
  onMove: () => tone(220, 20, 'square', 0.02),
  onRotate: () => tone(330, 30, 'square', 0.03),
  onHardDrop: () => tone(140, 60, 'triangle', 0.05),
  onLock: () => tone(180, 40, 'square', 0.03),
  onLineClear: (count: number) => tone(440 + count * 80, 120, 'sawtooth', 0.05),
  onTSpin: () => tone(660, 160, 'sawtooth', 0.06),
  onTetris: () => tone(880, 200, 'sawtooth', 0.06),
  onPerfectClear: () => {
    // A little ascending arpeggio for the big bonus.
    tone(660, 120, 'triangle', 0.06);
    setTimeout(() => tone(880, 120, 'triangle', 0.06), 90);
    setTimeout(() => tone(1175, 200, 'triangle', 0.06), 180);
  },
  onLevelUp: () => tone(990, 220, 'triangle', 0.06),
  onHold: () => tone(300, 40, 'square', 0.03),
  onGameOver: () => tone(110, 500, 'sawtooth', 0.06),
};

export type Sfx = typeof sfx;
