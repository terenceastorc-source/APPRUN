/**
 * Signaux sonores et vibrations pour les chronos.
 * L'AudioContext doit être créé lors d'un geste de l'utilisateur (règle des navigateurs mobiles).
 */
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctx && Ctor) ctx = new Ctor();
    void ctx?.resume();
  } catch {
    ctx = null;
  }
}

export function beep(frequency: number, durationMs: number, volume = 0.25): void {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + durationMs / 1000 + 0.02);
  } catch {
    /* audio indisponible */
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supporté (iOS) */
  }
}

/** Garde l'écran allumé tant que la fonction de libération n'est pas appelée. */
export async function keepScreenOn(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock?.request('screen');
    return () => void lock?.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}
