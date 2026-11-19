import { inPeriod, matchesScope, periodBounds, totals } from './stats';
import { CATEGORY_LABELS, SPORTS, isSportId, type SportCategory } from './sports';
import type { Activity, Goal, GoalMetric, GoalPeriod, GoalScope } from './types';

export const METRIC_LABELS: Record<GoalMetric, string> = { distance: 'Distance', duration: 'Durée', sessions: 'Séances', load: 'Charge' };
export const METRIC_UNITS: Record<GoalMetric, string> = { distance: 'km', duration: 'h', sessions: 'séances', load: 'pts' };
export const PERIOD_LABELS: Record<GoalPeriod, string> = { week: 'par semaine', month: 'par mois', year: 'par an' };

export function scopeLabel(scope: GoalScope): string {
  if (scope === 'all') return 'Toutes activités';
  if (isSportId(scope)) return SPORTS[scope].label;
  return CATEGORY_LABELS[scope as SportCategory];
}

/** Valeur réalisée dans l'unité de l'objectif (km, heures, séances, points). */
export function metricValue(activities: readonly Activity[], metric: GoalMetric): number {
  const t = totals(activities);
  switch (metric) {
    case 'distance':
      return t.distanceMeters / 1000;
    case 'duration':
      return t.durationSeconds / 3600;
    case 'sessions':
      return t.count;
    case 'load':
      return t.load;
  }
}

export interface GoalProgress {
  goal: Goal;
  done: number;
  ratio: number;
  /** Fraction de la période écoulée (pour savoir si on est « en avance »). */
  elapsed: number;
}

export function goalProgress(goal: Goal, activities: readonly Activity[], today: Date): GoalProgress {
  const list = inPeriod(activities, goal.period, today).filter((a) => matchesScope(a, goal.scope));
  const done = metricValue(list, goal.metric);
  const [from, to] = periodBounds(goal.period, today);
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
  const elapsed = Math.min(1, (endOfToday - from.getTime()) / (to.getTime() - from.getTime()));
  return { goal, done, ratio: goal.target > 0 ? done / goal.target : 0, elapsed };
}
