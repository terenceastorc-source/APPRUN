import { addDays, paceSecondsPerKm, parseLocalDate, startOfWeek, toIsoDate } from './format';
import { CATEGORIES, SPORTS, type SportCategory, type SportId } from './sports';
import type { Activity, GoalScope } from './types';
import { activityLoad } from './load';

export interface Totals {
  count: number;
  durationSeconds: number;
  distanceMeters: number;
  load: number;
}

export function totals(activities: readonly Activity[]): Totals {
  return activities.reduce<Totals>(
    (t, a) => ({
      count: t.count + 1,
      durationSeconds: t.durationSeconds + a.durationSeconds,
      distanceMeters: t.distanceMeters + (a.distanceMeters ?? 0),
      load: t.load + activityLoad(a),
    }),
    { count: 0, durationSeconds: 0, distanceMeters: 0, load: 0 },
  );
}

export function matchesScope(a: Activity, scope: GoalScope): boolean {
  if (scope === 'all') return true;
  if ((CATEGORIES as readonly string[]).includes(scope)) return SPORTS[a.sport].category === scope;
  return a.sport === scope;
}

/** Activités dans [from, toExclusive[. */
export function between(activities: readonly Activity[], from: Date, toExclusive: Date): Activity[] {
  const a = toIsoDate(from);
  const b = toIsoDate(toExclusive);
  return activities.filter((x) => x.date >= a && x.date < b);
}

export type Period = 'week' | 'month' | 'year';

/** Bornes [début, fin[ de la période qui contient `today`. */
export function periodBounds(period: Period, today: Date): [Date, Date] {
  if (period === 'week') {
    const s = startOfWeek(today);
    return [s, addDays(s, 7)];
  }
  if (period === 'month') return [new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 1)];
  return [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear() + 1, 0, 1)];
}

export function inPeriod(activities: readonly Activity[], period: Period, today: Date): Activity[] {
  const [from, to] = periodBounds(period, today);
  return between(activities, from, to);
}

export interface WeekByCategory {
  weekStart: string;
  /** Durée (s) par catégorie. */
  seconds: Record<SportCategory, number>;
  count: number;
}

/** Temps d'entraînement par semaine et par catégorie, sur `weeks` semaines (la plus ancienne d'abord). */
export function weeklyByCategory(activities: readonly Activity[], weeks: number, today: Date): WeekByCategory[] {
  const current = startOfWeek(today);
  const out: WeekByCategory[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    const list = between(activities, start, addDays(start, 7));
    const seconds: Record<SportCategory, number> = { endurance: 0, crossfit: 0, race: 0 };
    for (const a of list) seconds[SPORTS[a.sport].category] += a.durationSeconds;
    out.push({ weekStart: toIsoDate(start), seconds, count: list.length });
  }
  return out;
}

export interface SportShare {
  sport: SportId;
  count: number;
  durationSeconds: number;
  distanceMeters: number;
}

/** Répartition par sport, triée par temps décroissant. */
export function bySport(activities: readonly Activity[]): SportShare[] {
  const map = new Map<SportId, SportShare>();
  for (const a of activities) {
    const s = map.get(a.sport) ?? { sport: a.sport, count: 0, durationSeconds: 0, distanceMeters: 0 };
    s.count++;
    s.durationSeconds += a.durationSeconds;
    s.distanceMeters += a.distanceMeters ?? 0;
    map.set(a.sport, s);
  }
  return [...map.values()].sort((x, y) => y.durationSeconds - x.durationSeconds);
}

/** Semaines consécutives avec au moins une activité (la semaine en cours ne casse pas la série). */
export function weekStreak(activities: readonly Activity[], today: Date): number {
  const weeks = new Set(activities.map((a) => toIsoDate(startOfWeek(parseLocalDate(a.date)))));
  let cursor = startOfWeek(today);
  if (!weeks.has(toIsoDate(cursor))) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(toIsoDate(cursor))) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

/** Tri antichronologique stable (date, heure, création). */
export function sortByDateDesc<T extends { date: string; startTime?: string; createdAt?: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const t = (b.startTime ?? '').localeCompare(a.startTime ?? '');
    return t !== 0 ? t : (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}

export function averagePace(activities: readonly Activity[]): number {
  const t = totals(activities);
  return paceSecondsPerKm(t.distanceMeters, t.durationSeconds);
}
