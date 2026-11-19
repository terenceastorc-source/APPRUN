import type { Segment } from './types';

/** Les 8 ateliers d'une course HYROX, dans l'ordre (format standard). */
export const HYROX_STATIONS = [
  'SkiErg 1000 m',
  'Sled Push 50 m',
  'Sled Pull 50 m',
  'Burpee Broad Jumps 80 m',
  'Rameur 1000 m',
  'Farmers Carry 200 m',
  'Sandbag Lunges 100 m',
  'Wall Balls',
] as const;

export const HYROX_DIVISIONS = ['Open', 'Pro', 'Doubles', 'Relay'] as const;

/** Modèle de segments HYROX : 8 × (1 km de course + 1 atelier) + Roxzone. */
export function hyroxTemplate(): Segment[] {
  const segments: Segment[] = [];
  HYROX_STATIONS.forEach((station, i) => {
    segments.push({ name: `Course ${i + 1}`, kind: 'run' });
    segments.push({ name: station, kind: 'station' });
  });
  segments.push({ name: 'Roxzone (transitions)', kind: 'roxzone' });
  return segments;
}

export function segmentsTotal(segments: readonly Segment[]): number {
  return segments.reduce((acc, s) => acc + (s.seconds ?? 0), 0);
}

/** Répartition du temps par type de segment (course, ateliers, transitions). */
export function segmentBreakdown(segments: readonly Segment[]): Record<Segment['kind'], number> {
  const out = { run: 0, station: 0, roxzone: 0, other: 0 };
  for (const s of segments) out[s.kind] += s.seconds ?? 0;
  return out;
}
