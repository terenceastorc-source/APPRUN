import { addDays, toIsoDate } from '../domain/format';
import { goalProgress, METRIC_UNITS, PERIOD_LABELS, scopeLabel } from '../domain/goals';
import { LOAD_STATUS_LABELS, loadState } from '../domain/load';
import { SPORTS } from '../domain/sports';
import { RUN_TYPE_LABELS, WOD_FORMAT_LABELS, type Activity, type AppData } from '../domain/types';
import type { CoachContext } from './contract';

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const round1 = (n: number) => Math.round(n * 10) / 10;

function detail(a: Activity): string | undefined {
  const parts: string[] = [];
  if (a.runType) parts.push(RUN_TYPE_LABELS[a.runType]);
  if (a.crossfit) {
    parts.push(WOD_FORMAT_LABELS[a.crossfit.format]);
    if (a.crossfit.score) parts.push(`score ${a.crossfit.score}`);
    for (const l of a.crossfit.lifts ?? []) parts.push(`${l.exercise} ${l.sets}×${l.reps}${l.weightKg ? ` @${l.weightKg} kg` : ''}`);
  }
  if (a.race) parts.push(a.race.official ? 'course officielle' : 'entraînement');
  if (a.heartRateAvg) parts.push(`FC moy ${a.heartRateAvg}`);
  if (a.elevationGain) parts.push(`D+ ${a.elevationGain} m`);
  if (a.notes) parts.push(`notes : ${a.notes.slice(0, 160)}`);
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * Résumé compact des données utiles au coach : 14 jours de séances, 7 jours de mesures,
 * 7 jours de plan, charge et objectifs. Les données plus anciennes ne sont pas envoyées.
 */
export function buildCoachContext(data: AppData, today: Date): CoachContext {
  const todayIso = toIsoDate(today);
  const from14 = toIsoDate(addDays(today, -13));
  const from7 = toIsoDate(addDays(today, -6));
  const to7 = toIsoDate(addDays(today, 7));
  const load = loadState(data.activities, today);

  return {
    today: todayIso,
    weekday: WEEKDAYS[today.getDay()]!,
    profile: data.settings.maxHr ? { maxHr: data.settings.maxHr } : {},
    load: { acute7d: load.acute, chronicWeekly: Math.round(load.chronic), ratio: load.ratio === null ? null : Math.round(load.ratio * 100) / 100, status: LOAD_STATUS_LABELS[load.status] },
    recentSessions: data.activities
      .filter((a) => a.date >= from14 && a.date <= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
      .map((a) => ({
        date: a.date,
        sport: SPORTS[a.sport].label,
        title: a.title ?? a.crossfit?.wodName ?? SPORTS[a.sport].label,
        minutes: Math.round(a.durationSeconds / 60),
        ...(a.distanceMeters ? { km: round1(a.distanceMeters / 1000) } : {}),
        ...(a.rpe ? { rpe: a.rpe } : {}),
        ...(detail(a) ? { detail: detail(a) } : {}),
      })),
    body: data.body
      .filter((b) => b.date >= from7 && b.date <= todayIso)
      .map((b) => ({ date: b.date, weightKg: b.weightKg, sleepHours: b.sleepHours, restingHr: b.restingHr, form: b.form, notes: b.notes })),
    planned: data.plans
      .filter((p) => !p.activityId && p.date >= todayIso && p.date <= to7)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        date: p.date,
        sport: p.sport,
        title: p.title,
        ...(p.description ? { description: p.description.slice(0, 300) } : {}),
        ...(p.targetDurationMin ? { minutes: p.targetDurationMin } : {}),
        ...(p.targetDistanceKm ? { km: p.targetDistanceKm } : {}),
        ...(p.program ? { program: p.program.name } : {}),
      })),
    goals: data.goals.map((g) => {
      const p = goalProgress(g, data.activities, today);
      return { label: `${scopeLabel(g.scope)} ${PERIOD_LABELS[g.period]}`, progress: `${round1(p.done)} / ${g.target} ${METRIC_UNITS[g.metric]} (${Math.round(p.elapsed * 100)} % de la période écoulée)` };
    }),
  };
}
