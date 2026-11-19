import { parseDuration, paceSecondsPerKm } from './format';
import { segmentsTotal } from './hyrox';
import type { Activity, WodFormat } from './types';

export const RUN_RECORD_DISTANCES = [
  { label: '5 km', meters: 5000 },
  { label: '10 km', meters: 10000 },
  { label: 'Semi-marathon', meters: 21097 },
  { label: 'Marathon', meters: 42195 },
] as const;

export interface TimeRecord {
  label: string;
  seconds: number;
  activity: Activity;
}

/** Meilleurs temps de course à pied sur distances de référence (tolérance GPS ±2 %). */
export function runRecords(activities: readonly Activity[], tolerance = 0.02): TimeRecord[] {
  const runs = activities.filter((a) => a.sport === 'course' && a.distanceMeters);
  const out: TimeRecord[] = [];
  for (const { label, meters } of RUN_RECORD_DISTANCES) {
    const best = runs
      .filter((a) => Math.abs(a.distanceMeters! - meters) <= meters * tolerance)
      .reduce<Activity | undefined>((b, a) => (!b || a.durationSeconds < b.durationSeconds ? a : b), undefined);
    if (best) out.push({ label, seconds: best.durationSeconds, activity: best });
  }
  return out;
}

/** Meilleur temps HYROX / ATH X, séparément pour les courses officielles et les entraînements complets. */
export function raceRecords(activities: readonly Activity[]): TimeRecord[] {
  const out: TimeRecord[] = [];
  for (const sport of ['hyrox', 'athx'] as const) {
    for (const official of [true, false]) {
      const best = activities
        .filter((a) => a.sport === sport && a.race && a.race.official === official)
        .reduce<Activity | undefined>((b, a) => (!b || a.durationSeconds < b.durationSeconds ? a : b), undefined);
      if (best) out.push({ label: `${sport === 'hyrox' ? 'HYROX' : 'ATH X'} ${official ? '(course)' : '(entraînement)'}`, seconds: best.durationSeconds, activity: best });
    }
  }
  return out;
}

/** Meilleur temps par segment (atelier ou course) sur les HYROX enregistrés. */
export function bestSegments(activities: readonly Activity[], sport: 'hyrox' | 'athx' = 'hyrox'): Map<string, number> {
  const best = new Map<string, number>();
  for (const a of activities) {
    if (a.sport !== sport || !a.race) continue;
    for (const s of a.race.segments) {
      if (!s.seconds) continue;
      const cur = best.get(s.name);
      if (cur === undefined || s.seconds < cur) best.set(s.name, s.seconds);
    }
  }
  return best;
}

/**
 * Convertit un score CrossFit en nombre comparable.
 * For Time : secondes (plus petit = meilleur). AMRAP : tours × 1000 + reps (plus grand = meilleur).
 * Force : charge en kg (plus grand = meilleur).
 */
export function scoreValue(format: WodFormat, score: string | undefined): { value: number; lowerIsBetter: boolean } | null {
  if (!score) return null;
  const s = score.trim().toLowerCase();
  if (format === 'for-time') {
    const t = parseDuration(s);
    return t ? { value: t, lowerIsBetter: true } : null;
  }
  if (format === 'amrap') {
    const m = /^(\d+)\s*(?:\+\s*(\d+))?/.exec(s);
    return m ? { value: Number(m[1]) * 1000 + Number(m[2] ?? 0), lowerIsBetter: false } : null;
  }
  if (format === 'force') {
    const m = /^(\d+(?:[.,]\d+)?)/.exec(s);
    return m ? { value: Number(m[1]!.replace(',', '.')), lowerIsBetter: false } : null;
  }
  return null;
}

export interface BenchmarkRecord {
  wodName: string;
  score: string;
  activity: Activity;
  attempts: number;
}

/** Meilleur score par WOD nommé (benchmarks : Fran, Murph, Cindy…). Les WOD RX priment sur scaled. */
export function benchmarkRecords(activities: readonly Activity[]): BenchmarkRecord[] {
  const groups = new Map<string, Activity[]>();
  for (const a of activities) {
    const name = a.crossfit?.wodName?.trim();
    if (!name || !a.crossfit?.score) continue;
    const key = name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const out: BenchmarkRecord[] = [];
  for (const list of groups.values()) {
    const rx = list.filter((a) => a.crossfit!.level === 'rx');
    const pool = rx.length ? rx : list;
    let best: Activity | undefined;
    let bestVal: { value: number; lowerIsBetter: boolean } | null = null;
    for (const a of pool) {
      const v = scoreValue(a.crossfit!.format, a.crossfit!.score);
      if (!v) continue;
      if (!bestVal || (v.lowerIsBetter ? v.value < bestVal.value : v.value > bestVal.value)) {
        best = a;
        bestVal = v;
      }
    }
    best ??= pool[0]!;
    out.push({ wodName: best.crossfit!.wodName!.trim(), score: best.crossfit!.score!, activity: best, attempts: list.length });
  }
  return out.sort((a, b) => a.wodName.localeCompare(b.wodName, 'fr'));
}

/** Charge maximale soulevée par exercice (toutes séances CrossFit). */
export function liftRecords(activities: readonly Activity[]): { exercise: string; weightKg: number; reps: number; date: string }[] {
  const best = new Map<string, { exercise: string; weightKg: number; reps: number; date: string }>();
  for (const a of activities) {
    for (const l of a.crossfit?.lifts ?? []) {
      if (!l.weightKg) continue;
      const key = l.exercise.trim().toLowerCase();
      const cur = best.get(key);
      if (!cur || l.weightKg > cur.weightKg) best.set(key, { exercise: l.exercise.trim(), weightKg: l.weightKg, reps: l.reps, date: a.date });
    }
  }
  return [...best.values()].sort((a, b) => a.exercise.localeCompare(b.exercise, 'fr'));
}

/** Estimation du 1RM (formule d'Epley). */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

export interface EnduranceHighlights {
  longest?: Activity;
  fastest?: Activity;
}

export function enduranceHighlights(activities: readonly Activity[], sport: 'course' | 'velo' | 'trail' = 'course'): EnduranceHighlights {
  const list = activities.filter((a) => a.sport === sport && (a.distanceMeters ?? 0) > 0);
  return {
    longest: list.reduce<Activity | undefined>((b, a) => (!b || a.distanceMeters! > b.distanceMeters! ? a : b), undefined),
    fastest: list
      .filter((a) => a.distanceMeters! >= 1000)
      .reduce<Activity | undefined>(
        (b, a) => (!b || paceSecondsPerKm(a.distanceMeters!, a.durationSeconds) < paceSecondsPerKm(b.distanceMeters!, b.durationSeconds) ? a : b),
        undefined,
      ),
  };
}

export { segmentsTotal };
