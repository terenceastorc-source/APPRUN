import { addDays, toIsoDate } from './format';
import type { Activity } from './types';

/**
 * Charge d'une séance selon la méthode sRPE (Foster) : durée en minutes × effort perçu (1–10).
 * Elle permet de comparer des sports différents (course, CrossFit, HYROX…).
 * Sans RPE renseigné, la séance ne compte pas dans la charge.
 */
export function activityLoad(a: Pick<Activity, 'durationSeconds' | 'rpe'>): number {
  if (!a.rpe) return 0;
  return Math.round((a.durationSeconds / 60) * a.rpe);
}

/** Charge par jour sur `days` jours se terminant à `today` inclus (le plus ancien d'abord). */
export function dailyLoads(activities: readonly Activity[], days: number, today: Date): { date: string; load: number }[] {
  const byDate = new Map<string, number>();
  for (const a of activities) byDate.set(a.date, (byDate.get(a.date) ?? 0) + activityLoad(a));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = toIsoDate(addDays(today, -i));
    out.push({ date, load: byDate.get(date) ?? 0 });
  }
  return out;
}

export type LoadStatus = 'insuffisant' | 'reprise' | 'optimal' | 'eleve' | 'risque';

export interface LoadState {
  /** Charge des 7 derniers jours. */
  acute: number;
  /** Moyenne hebdomadaire sur les 28 derniers jours. */
  chronic: number;
  /** Rapport aiguë / chronique (ACWR), null si pas assez d'historique. */
  ratio: number | null;
  status: LoadStatus;
}

/**
 * État de charge à la date donnée. Repères usuels de l'ACWR :
 * < 0,8 sous-charge, 0,8–1,3 zone optimale, 1,3–1,5 élevée, > 1,5 risque de blessure accru.
 */
export function loadState(activities: readonly Activity[], today: Date): LoadState {
  const days = dailyLoads(activities, 28, today);
  const acute = days.slice(-7).reduce((s, d) => s + d.load, 0);
  const chronic = days.reduce((s, d) => s + d.load, 0) / 4;
  if (chronic === 0) return { acute, chronic, ratio: null, status: acute > 0 ? 'reprise' : 'insuffisant' };
  const ratio = acute / chronic;
  const status: LoadStatus = ratio < 0.8 ? 'insuffisant' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'eleve' : 'risque';
  return { acute, chronic, ratio, status };
}

export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
  insuffisant: 'Charge basse',
  reprise: 'Reprise',
  optimal: 'Zone optimale',
  eleve: 'Charge élevée',
  risque: 'Risque de surcharge',
};

/** Série hebdomadaire de charge aiguë/chronique pour le graphique (une valeur par semaine). */
export function loadHistory(activities: readonly Activity[], weeks: number, today: Date): { date: string; acute: number; chronic: number }[] {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = addDays(today, -7 * i);
    const s = loadState(activities, d);
    out.push({ date: toIsoDate(d), acute: s.acute, chronic: Math.round(s.chronic) });
  }
  return out;
}
