import { addDays, paceSecondsPerKm, toIsoDate } from './format';
import { RUN_RECORD_DISTANCES, estimateOneRepMax, scoreValue } from './records';
import type { Activity, Settings } from './types';

// --- Course : prédictions ---

/**
 * Formule de Riegel : T2 = T1 × (D2 / D1)^1,06.
 * Fiable pour extrapoler entre distances proches ; moins au-delà d'un facteur ~8.
 */
export function riegel(distanceMeters: number, seconds: number, targetMeters: number, exponent = 1.06): number {
  return seconds * (targetMeters / distanceMeters) ** exponent;
}

export interface Prediction {
  label: string;
  meters: number;
  seconds: number;
  basedOn: Activity;
}

/**
 * Temps prédits sur 5 km → marathon, à partir de la meilleure performance récente
 * (course à pied ≥ 3 km sur `windowDays` jours). Les sorties trop courtes par rapport
 * à la distance visée (moins d'1/8) sont écartées.
 */
export function racePredictions(activities: readonly Activity[], today: Date, windowDays = 90): Prediction[] {
  const from = toIsoDate(addDays(today, -windowDays));
  const runs = activities.filter((a) => a.sport === 'course' && (a.distanceMeters ?? 0) >= 3000 && a.date >= from);
  const out: Prediction[] = [];
  for (const { label, meters } of RUN_RECORD_DISTANCES) {
    let best: Prediction | undefined;
    for (const r of runs) {
      if (r.distanceMeters! < meters / 8) continue;
      const seconds = riegel(r.distanceMeters!, r.durationSeconds, meters);
      if (!best || seconds < best.seconds) best = { label, meters, seconds: Math.round(seconds), basedOn: r };
    }
    if (best) out.push(best);
  }
  return out;
}

export interface MonthPoint {
  month: string;
  distanceMeters: number;
  /** Allure moyenne (s/km), null sans course. */
  pace: number | null;
  count: number;
}

/** Volume et allure moyenne de course à pied par mois (le plus ancien d'abord). */
export function monthlyRunning(activities: readonly Activity[], months: number, today: Date): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = toIsoDate(d).slice(0, 7);
    const list = activities.filter((a) => a.sport === 'course' && a.date.startsWith(key) && a.distanceMeters);
    const dist = list.reduce((s, a) => s + a.distanceMeters!, 0);
    const dur = list.reduce((s, a) => s + a.durationSeconds, 0);
    out.push({ month: key, distanceMeters: dist, pace: dist > 0 ? paceSecondsPerKm(dist, dur) : null, count: list.length });
  }
  return out;
}

// --- Fréquence cardiaque ---

export const HR_ZONES = [
  { id: 1, label: 'Z1 Récupération', min: 0, max: 0.6 },
  { id: 2, label: 'Z2 Endurance', min: 0.6, max: 0.7 },
  { id: 3, label: 'Z3 Tempo', min: 0.7, max: 0.8 },
  { id: 4, label: 'Z4 Seuil', min: 0.8, max: 0.9 },
  { id: 5, label: 'Z5 VO2max', min: 0.9, max: Number.POSITIVE_INFINITY },
] as const;

/** FC max : celle du profil, sinon la plus haute FC max enregistrée (estimation). */
export function maxHeartRate(settings: Settings, activities: readonly Activity[]): { bpm: number; estimated: boolean } | null {
  if (settings.maxHr) return { bpm: settings.maxHr, estimated: false };
  const observed = Math.max(0, ...activities.map((a) => a.heartRateMax ?? 0));
  return observed > 0 ? { bpm: observed, estimated: true } : null;
}

export function zoneOf(bpm: number, maxHr: number): (typeof HR_ZONES)[number] {
  const r = bpm / maxHr;
  return HR_ZONES.find((z) => r >= z.min && r < z.max) ?? HR_ZONES[4];
}

/**
 * Temps passé par zone sur la période. Approximation : chaque séance est rangée
 * entière dans la zone de sa FC moyenne (sans fichier seconde par seconde).
 */
export function timeInZones(activities: readonly Activity[], maxHr: number, today: Date, days = 28): { zone: (typeof HR_ZONES)[number]; seconds: number; count: number }[] {
  const from = toIsoDate(addDays(today, -(days - 1)));
  const acc = HR_ZONES.map((zone) => ({ zone, seconds: 0, count: 0 }));
  for (const a of activities) {
    if (!a.heartRateAvg || a.date < from) continue;
    const z = acc[zoneOf(a.heartRateAvg, maxHr).id - 1]!;
    z.seconds += a.durationSeconds;
    z.count++;
  }
  return acc;
}

// --- CrossFit ---

export interface ScorePoint {
  date: string;
  value: number;
  score: string;
  rx: boolean;
}

/** Noms des benchmarks avec au moins un score, du plus pratiqué au moins pratiqué. */
export function benchmarkNames(activities: readonly Activity[]): string[] {
  const count = new Map<string, { name: string; n: number }>();
  for (const a of activities) {
    const n = a.crossfit?.wodName?.trim();
    if (!n || !a.crossfit?.score) continue;
    const k = n.toLowerCase();
    count.set(k, { name: count.get(k)?.name ?? n, n: (count.get(k)?.n ?? 0) + 1 });
  }
  return [...count.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'fr')).map((x) => x.name);
}

/** Historique des scores d'un benchmark (ordre chronologique). */
export function benchmarkHistory(activities: readonly Activity[], wodName: string): { points: ScorePoint[]; lowerIsBetter: boolean } {
  const key = wodName.trim().toLowerCase();
  let lowerIsBetter = false;
  const points: ScorePoint[] = [];
  for (const a of [...activities].sort((x, y) => x.date.localeCompare(y.date))) {
    const c = a.crossfit;
    if (!c || c.wodName?.trim().toLowerCase() !== key) continue;
    const v = scoreValue(c.format, c.score);
    if (!v) continue;
    lowerIsBetter = v.lowerIsBetter;
    points.push({ date: a.date, value: v.value, score: c.score!, rx: c.level === 'rx' });
  }
  return { points, lowerIsBetter };
}

export function liftNames(activities: readonly Activity[]): string[] {
  const names = new Map<string, string>();
  for (const a of activities) for (const l of a.crossfit?.lifts ?? []) if (l.weightKg) names.set(l.exercise.trim().toLowerCase(), names.get(l.exercise.trim().toLowerCase()) ?? l.exercise.trim());
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Meilleur 1RM estimé par séance pour un exercice (ordre chronologique). */
export function liftHistory(activities: readonly Activity[], exercise: string): { date: string; oneRm: number; weightKg: number; reps: number }[] {
  const key = exercise.trim().toLowerCase();
  const out = [];
  for (const a of [...activities].sort((x, y) => x.date.localeCompare(y.date))) {
    let best: { oneRm: number; weightKg: number; reps: number } | undefined;
    for (const l of a.crossfit?.lifts ?? []) {
      if (l.exercise.trim().toLowerCase() !== key || !l.weightKg) continue;
      const oneRm = Math.round(estimateOneRepMax(l.weightKg, l.reps) * 10) / 10;
      if (!best || oneRm > best.oneRm) best = { oneRm, weightKg: l.weightKg, reps: l.reps };
    }
    if (best) out.push({ date: a.date, ...best });
  }
  return out;
}

// --- HYROX / ATH X ---

export function raceHistory(activities: readonly Activity[], sport: 'hyrox' | 'athx'): { date: string; seconds: number; official: boolean }[] {
  return activities
    .filter((a) => a.sport === sport && a.race)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({ date: a.date, seconds: a.durationSeconds, official: a.race!.official }));
}

export interface StationStat {
  name: string;
  kind: string;
  last: number;
  best: number;
  average: number;
  count: number;
  /** Écart du dernier temps au record (s). */
  gap: number;
}

/** Statistiques par segment ; l'ordre suit celui de la dernière course. */
export function stationStats(activities: readonly Activity[], sport: 'hyrox' | 'athx'): StationStat[] {
  const races = activities.filter((a) => a.sport === sport && a.race).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const map = new Map<string, { name: string; kind: string; times: number[] }>();
  const order: string[] = [];
  for (const r of races) {
    for (const s of r.race!.segments) {
      if (!s.seconds) continue;
      const k = s.name.trim().toLowerCase();
      if (!map.has(k)) {
        map.set(k, { name: s.name.trim(), kind: s.kind, times: [] });
        order.push(k);
      }
      map.get(k)!.times.push(s.seconds);
    }
  }
  return order.map((k) => {
    const { name, kind, times } = map.get(k)!;
    const last = times[times.length - 1]!;
    const best = Math.min(...times);
    return { name, kind, last, best, average: Math.round(times.reduce((s, t) => s + t, 0) / times.length), count: times.length, gap: last - best };
  });
}
