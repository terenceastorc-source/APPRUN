import { paceSecondsPerKm, parseLocalDate, toIsoDate } from './format';
import type { Run } from './types';

export interface Totals {
  count: number;
  distanceMeters: number;
  durationSeconds: number;
  /** Allure moyenne pondérée par la distance (s/km), 0 si aucune course. */
  avgPace: number;
}

export function totals(runs: readonly Run[]): Totals {
  const distanceMeters = runs.reduce((acc, r) => acc + r.distanceMeters, 0);
  const durationSeconds = runs.reduce((acc, r) => acc + r.durationSeconds, 0);
  return { count: runs.length, distanceMeters, durationSeconds, avgPace: paceSecondsPerKm(distanceMeters, durationSeconds) };
}

/** Lundi (00:00) de la semaine contenant la date donnée. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - offset);
  return d;
}

export function runsBetween(runs: readonly Run[], from: Date, toExclusive: Date): Run[] {
  const a = toIsoDate(from);
  const b = toIsoDate(toExclusive);
  return runs.filter((r) => r.date >= a && r.date < b);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface WeekBucket {
  /** Lundi de la semaine, AAAA-MM-JJ. */
  weekStart: string;
  distanceMeters: number;
  count: number;
}

/** Kilométrage des `weeks` dernières semaines (la plus ancienne en premier), semaines vides incluses. */
export function weeklyDistance(runs: readonly Run[], weeks: number, today: Date = new Date()): WeekBucket[] {
  const current = startOfWeek(today);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    const inWeek = runsBetween(runs, start, addDays(start, 7));
    buckets.push({ weekStart: toIsoDate(start), distanceMeters: totals(inWeek).distanceMeters, count: inWeek.length });
  }
  return buckets;
}

export interface PeriodSummary {
  week: Totals;
  month: Totals;
  year: Totals;
  all: Totals;
}

export function periodSummary(runs: readonly Run[], today: Date = new Date()): PeriodSummary {
  const weekStart = startOfWeek(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const tomorrow = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), 1);
  return {
    week: totals(runsBetween(runs, weekStart, tomorrow)),
    month: totals(runsBetween(runs, monthStart, tomorrow)),
    year: totals(runsBetween(runs, yearStart, tomorrow)),
    all: totals(runs),
  };
}

export const RECORD_DISTANCES = [
  { label: '5 km', meters: 5000 },
  { label: '10 km', meters: 10000 },
  { label: 'Semi-marathon', meters: 21097 },
  { label: 'Marathon', meters: 42195 },
] as const;

export interface DistanceRecord {
  label: string;
  meters: number;
  run: Run;
  /** Temps de la course (en secondes). */
  timeSeconds: number;
}

/**
 * Records par distance : meilleur temps parmi les sorties dont la distance
 * correspond à la distance cible (tolérance de ±2 %, pour les mesures GPS).
 */
export function distanceRecords(runs: readonly Run[], tolerance = 0.02): DistanceRecord[] {
  const records: DistanceRecord[] = [];
  for (const { label, meters } of RECORD_DISTANCES) {
    const candidates = runs.filter((r) => Math.abs(r.distanceMeters - meters) <= meters * tolerance);
    const best = candidates.reduce<Run | undefined>((b, r) => (!b || r.durationSeconds < b.durationSeconds ? r : b), undefined);
    if (best) records.push({ label, meters, run: best, timeSeconds: best.durationSeconds });
  }
  return records;
}

export interface Highlights {
  longest?: Run;
  fastest?: Run;
  longestDuration?: Run;
}

/** Sortie la plus longue, la plus rapide (≥ 1 km) et la plus longue en durée. */
export function highlights(runs: readonly Run[]): Highlights {
  const pick = (list: readonly Run[], better: (a: Run, b: Run) => boolean) =>
    list.reduce<Run | undefined>((best, r) => (!best || better(r, best) ? r : best), undefined);
  return {
    longest: pick(runs, (a, b) => a.distanceMeters > b.distanceMeters),
    fastest: pick(
      runs.filter((r) => r.distanceMeters >= 1000),
      (a, b) => paceSecondsPerKm(a.distanceMeters, a.durationSeconds) < paceSecondsPerKm(b.distanceMeters, b.durationSeconds),
    ),
    longestDuration: pick(runs, (a, b) => a.durationSeconds > b.durationSeconds),
  };
}

/** Nombre de semaines consécutives (jusqu'à la semaine courante ou la précédente) avec au moins une sortie. */
export function weekStreak(runs: readonly Run[], today: Date = new Date()): number {
  const weeks = new Set(runs.map((r) => toIsoDate(startOfWeek(parseLocalDate(r.date)))));
  let cursor = startOfWeek(today);
  // La semaine en cours ne casse pas la série si on n'a pas encore couru.
  if (!weeks.has(toIsoDate(cursor))) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(toIsoDate(cursor))) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

/** Tri antichronologique stable (date puis heure de création). */
export function sortByDateDesc(runs: readonly Run[]): Run[] {
  return [...runs].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}
