/**
 * Tiny UI click sound — WebAudio oscillator blip, generated in code.
 * No audio assets. Preference persisted in localStorage (default ON).
 */

const KEY = 'mosshaw-sound';

export function getSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable — ignore */
  }
}

let ctx: AudioContext | null = null;

/** Short, quiet "tick" for primary button presses. */
export function playTick(): void {
  try {
    if (!getSoundEnabled()) return;
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1750, t);
    osc.frequency.exponentialRampToValueAtTime(1150, t + 0.045);
    gain.gain.setValueAtTime(0.055, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  } catch {
    /* audio unavailable — stay silent */
  }
}
