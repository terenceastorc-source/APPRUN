import type { WodFormat } from './types';

export const TIMER_MODES = ['for-time', 'amrap', 'emom', 'tabata', 'intervals'] as const;
export type TimerMode = (typeof TIMER_MODES)[number];

export const TIMER_LABELS: Record<TimerMode, string> = {
  'for-time': 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  tabata: 'Tabata',
  intervals: 'Intervalles',
};

export const TIMER_DESCRIPTIONS: Record<TimerMode, string> = {
  'for-time': 'Le plus vite possible, avec un temps limite (time cap).',
  amrap: 'Un maximum de tours en un temps donné.',
  emom: 'Un exercice au début de chaque intervalle (chaque minute par défaut).',
  tabata: '8 × 20 s d’effort / 10 s de repos.',
  intervals: 'Travail / récupération, à régler librement.',
};

export interface TimerConfig {
  mode: TimerMode;
  /** For Time : limite de temps (0 = sans limite). AMRAP : durée totale. */
  durationSeconds: number;
  /** EMOM / Tabata / Intervalles : nombre de tours. */
  rounds: number;
  /** EMOM : durée d'un intervalle. Tabata / Intervalles : durée d'effort. */
  workSeconds: number;
  /** Tabata / Intervalles : récupération. */
  restSeconds: number;
  /** Compte à rebours avant le départ. */
  prepSeconds: number;
}

export const TIMER_PRESETS: Record<TimerMode, TimerConfig> = {
  'for-time': { mode: 'for-time', durationSeconds: 20 * 60, rounds: 1, workSeconds: 0, restSeconds: 0, prepSeconds: 10 },
  amrap: { mode: 'amrap', durationSeconds: 12 * 60, rounds: 1, workSeconds: 0, restSeconds: 0, prepSeconds: 10 },
  emom: { mode: 'emom', durationSeconds: 0, rounds: 10, workSeconds: 60, restSeconds: 0, prepSeconds: 10 },
  tabata: { mode: 'tabata', durationSeconds: 0, rounds: 8, workSeconds: 20, restSeconds: 10, prepSeconds: 10 },
  intervals: { mode: 'intervals', durationSeconds: 0, rounds: 8, workSeconds: 60, restSeconds: 60, prepSeconds: 10 },
};

export type PhaseKind = 'prep' | 'work' | 'rest';

export interface Phase {
  kind: PhaseKind;
  /** Durée en secondes ; Infinity pour un For Time sans limite. */
  seconds: number;
  /** Tour (1…n) ; 0 pour la préparation. */
  round: number;
}

/** Déroule la configuration en une suite de phases. */
export function buildPhases(c: TimerConfig): Phase[] {
  const phases: Phase[] = [];
  if (c.prepSeconds > 0) phases.push({ kind: 'prep', seconds: c.prepSeconds, round: 0 });
  switch (c.mode) {
    case 'for-time':
      phases.push({ kind: 'work', seconds: c.durationSeconds > 0 ? c.durationSeconds : Number.POSITIVE_INFINITY, round: 1 });
      break;
    case 'amrap':
      phases.push({ kind: 'work', seconds: c.durationSeconds, round: 1 });
      break;
    case 'emom':
      for (let r = 1; r <= c.rounds; r++) phases.push({ kind: 'work', seconds: c.workSeconds, round: r });
      break;
    case 'tabata':
    case 'intervals':
      for (let r = 1; r <= c.rounds; r++) {
        phases.push({ kind: 'work', seconds: c.workSeconds, round: r });
        // Pas de récupération après le dernier effort.
        if (r < c.rounds && c.restSeconds > 0) phases.push({ kind: 'rest', seconds: c.restSeconds, round: r });
      }
      break;
  }
  return phases;
}

/** Durée totale hors préparation (Infinity si For Time sans limite). */
export function workoutSeconds(c: TimerConfig): number {
  return buildPhases(c)
    .filter((p) => p.kind !== 'prep')
    .reduce((s, p) => s + p.seconds, 0);
}

export interface TimerSnapshot {
  phase: PhaseKind | 'done';
  phaseIndex: number;
  round: number;
  totalRounds: number;
  /** Secondes écoulées dans la phase courante. */
  phaseElapsed: number;
  /** Secondes restantes dans la phase courante (Infinity si sans limite). */
  phaseRemaining: number;
  /** Temps de séance écoulé, préparation exclue (s). */
  workoutElapsed: number;
}

/** État du chrono après `elapsedSeconds` depuis le départ (pauses déjà retirées). */
export function timerAt(c: TimerConfig, elapsedSeconds: number, phases: Phase[] = buildPhases(c)): TimerSnapshot {
  const totalRounds = c.mode === 'for-time' || c.mode === 'amrap' ? 1 : c.rounds;
  const prep = phases[0]?.kind === 'prep' ? phases[0].seconds : 0;
  let t = Math.max(0, elapsedSeconds);
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i]!;
    if (t < p.seconds) {
      return { phase: p.kind, phaseIndex: i, round: p.round, totalRounds, phaseElapsed: t, phaseRemaining: p.seconds - t, workoutElapsed: Math.max(0, elapsedSeconds - prep) };
    }
    t -= p.seconds;
  }
  const total = workoutSeconds(c);
  return { phase: 'done', phaseIndex: phases.length, round: totalRounds, totalRounds, phaseElapsed: 0, phaseRemaining: 0, workoutElapsed: total };
}

/** Chronomètre avec pause : le temps est calculé à partir de l'horloge, pas d'un compteur. */
export interface RunClock {
  startedAt: number;
  pausedAt?: number;
  pausedMs: number;
}

export function clockStart(now: number): RunClock {
  return { startedAt: now, pausedMs: 0 };
}
export function clockPause(c: RunClock, now: number): RunClock {
  return c.pausedAt !== undefined ? c : { ...c, pausedAt: now };
}
export function clockResume(c: RunClock, now: number): RunClock {
  return c.pausedAt === undefined ? c : { startedAt: c.startedAt, pausedMs: c.pausedMs + (now - c.pausedAt) };
}
export function clockElapsed(c: RunClock, now: number): number {
  return ((c.pausedAt ?? now) - c.startedAt - c.pausedMs) / 1000;
}

/** Format de WOD correspondant au chrono, pour enregistrer la séance. */
export function wodFormatFor(mode: TimerMode): WodFormat {
  return mode === 'intervals' ? 'autre' : mode;
}

/** Titre par défaut : « AMRAP 12 min », « EMOM 10 × 1:00 », « Tabata 8 × 20/10 ». */
export function timerTitle(c: TimerConfig): string {
  const mmss = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  switch (c.mode) {
    case 'for-time':
      return c.durationSeconds > 0 ? `For Time (cap ${mmss(c.durationSeconds)})` : 'For Time';
    case 'amrap':
      return `AMRAP ${mmss(c.durationSeconds)}`;
    case 'emom':
      return c.workSeconds === 60 ? `EMOM ${c.rounds} min` : `EMOM ${c.rounds} × ${mmss(c.workSeconds)}`;
    case 'tabata':
      return `Tabata ${c.rounds} × ${c.workSeconds}/${c.restSeconds}`;
    case 'intervals':
      return `${c.rounds} × ${mmss(c.workSeconds)} / ${mmss(c.restSeconds)}`;
  }
}

export function validateTimer(c: TimerConfig): string | null {
  if (c.mode === 'amrap' && !(c.durationSeconds >= 30)) return "Durée de l'AMRAP : 30 s minimum.";
  if (c.mode === 'for-time' && c.durationSeconds < 0) return 'Time cap invalide.';
  if (['emom', 'tabata', 'intervals'].includes(c.mode)) {
    if (!(c.rounds >= 1 && c.rounds <= 100)) return 'Nombre de tours entre 1 et 100.';
    if (!(c.workSeconds >= 5)) return "Durée d'effort : 5 s minimum.";
  }
  if (c.mode !== 'emom' && c.mode !== 'for-time' && c.mode !== 'amrap' && c.restSeconds < 0) return 'Récupération invalide.';
  return null;
}
