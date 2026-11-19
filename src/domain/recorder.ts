import { DEFAULT_FILTER, acceptPoint, currentPace, elevationGain, kmSplits, trackDistance, type TrackPoint } from './geo';
import type { SportId } from './sports';

export type RecorderStatus = 'idle' | 'running' | 'paused';

/** État sérialisable d'un enregistrement GPS (sauvegardé pour reprendre après un rechargement). */
export interface RecorderState {
  sport: SportId;
  status: RecorderStatus;
  /** Horodatage du démarrage (ms). */
  startedAt?: number;
  /** Temps actif cumulé avant la portion en cours (ms). */
  accumulatedMs: number;
  /** Début de la portion active en cours (ms). */
  activeSince?: number;
  /** Portions de trace : une nouvelle portion commence à chaque reprise. */
  segments: TrackPoint[][];
}

export function initialRecorder(sport: SportId): RecorderState {
  return { sport, status: 'idle', accumulatedMs: 0, segments: [] };
}

export function start(s: RecorderState, now: number): RecorderState {
  if (s.status !== 'idle') return s;
  return { ...s, status: 'running', startedAt: now, activeSince: now, segments: [[]] };
}

export function pause(s: RecorderState, now: number): RecorderState {
  if (s.status !== 'running') return s;
  return { ...s, status: 'paused', accumulatedMs: s.accumulatedMs + (now - (s.activeSince ?? now)), activeSince: undefined };
}

export function resume(s: RecorderState, now: number): RecorderState {
  if (s.status !== 'paused') return s;
  return { ...s, status: 'running', activeSince: now, segments: [...s.segments, []] };
}

/** Ajoute un point à la portion en cours s'il passe les filtres (précision, bruit, sauts). */
export function addPoint(s: RecorderState, p: TrackPoint): RecorderState {
  if (s.status !== 'running') return s;
  const segs = s.segments.length ? s.segments : [[]];
  const current = segs[segs.length - 1]!;
  if (!acceptPoint(current[current.length - 1], p, DEFAULT_FILTER)) return s;
  return { ...s, segments: [...segs.slice(0, -1), [...current, p]] };
}

export function elapsedMs(s: RecorderState, now: number): number {
  return s.accumulatedMs + (s.status === 'running' && s.activeSince !== undefined ? now - s.activeSince : 0);
}

export interface RecorderSummary {
  distanceMeters: number;
  durationSeconds: number;
  elevationGain: number;
  splits: number[];
  /** Allure instantanée (s/km) ou null. */
  currentPace: number | null;
  pointCount: number;
}

export function summarize(s: RecorderState, now: number): RecorderSummary {
  const nonEmpty = s.segments.filter((seg) => seg.length > 0);
  const last = nonEmpty[nonEmpty.length - 1] ?? [];
  return {
    distanceMeters: Math.round(nonEmpty.reduce((d, seg) => d + trackDistance(seg), 0)),
    durationSeconds: Math.round(elapsedMs(s, now) / 1000),
    elevationGain: nonEmpty.reduce((g, seg) => g + elevationGain(seg), 0),
    splits: kmSplits(nonEmpty),
    currentPace: s.status === 'running' ? currentPace(last) : null,
    pointCount: nonEmpty.reduce((n, seg) => n + seg.length, 0),
  };
}
