import { isSportId, SPORTS } from './sports';
import { RUN_TYPES, WOD_FORMATS, WOD_LEVELS, type ActivityInput, type BodyEntry, type PlannedSession } from './types';

export type Errors<T> = Partial<Record<keyof T | string, string>>;

function inRange(n: number | undefined, min: number, max: number): boolean {
  return n === undefined || (Number.isFinite(n) && n >= min && n <= max);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateActivity(input: ActivityInput, today: string): Errors<ActivityInput> {
  const e: Errors<ActivityInput> = {};
  if (!isSportId(input.sport)) e.sport = 'Sport inconnu.';
  if (!DATE_RE.test(input.date)) e.date = 'Date invalide.';
  else if (input.date > today) e.date = 'La date ne peut pas être dans le futur (utilise le Plan pour les séances à venir).';
  if (input.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) e.startTime = 'Heure invalide.';
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) e.durationSeconds = 'Durée invalide (ex. 45:30 ou 1:05:00).';
  else if (input.durationSeconds > 7 * 24 * 3600) e.durationSeconds = 'Durée trop longue.';
  if (!inRange(input.rpe, 1, 10) || (input.rpe !== undefined && !Number.isInteger(input.rpe))) e.rpe = "L'effort va de 1 à 10.";
  if (!inRange(input.heartRateAvg, 30, 250)) e.heartRateAvg = 'FC entre 30 et 250 bpm.';
  if (!inRange(input.heartRateMax, 30, 250)) e.heartRateMax = 'FC entre 30 et 250 bpm.';
  if (input.heartRateAvg && input.heartRateMax && input.heartRateAvg > input.heartRateMax) e.heartRateMax = 'La FC max doit être ≥ à la FC moyenne.';
  if (!inRange(input.calories, 0, 20000)) e.calories = 'Calories invalides.';

  if (isSportId(input.sport) && SPORTS[input.sport].category === 'endurance') {
    if (input.distanceMeters === undefined || !Number.isFinite(input.distanceMeters) || input.distanceMeters <= 0)
      e.distanceMeters = 'Indique une distance positive (en km).';
    else if (input.distanceMeters > 1_000_000) e.distanceMeters = 'Distance trop grande.';
  } else if (!inRange(input.distanceMeters, 0, 1_000_000)) e.distanceMeters = 'Distance invalide.';
  if (!inRange(input.elevationGain, 0, 20000)) e.elevationGain = 'Dénivelé entre 0 et 20 000 m.';
  if (input.runType !== undefined && !RUN_TYPES.includes(input.runType)) e.runType = 'Type de sortie inconnu.';

  if (input.crossfit) {
    if (!WOD_FORMATS.includes(input.crossfit.format)) e.crossfit = 'Format de WOD inconnu.';
    if (!WOD_LEVELS.includes(input.crossfit.level)) e.crossfit = 'Niveau inconnu.';
    input.crossfit.lifts?.forEach((l, i) => {
      if (!l.exercise.trim()) e[`lift-${i}`] = "Nom d'exercice manquant.";
      else if (!(l.sets >= 1 && l.reps >= 1) || !inRange(l.weightKg, 0, 1000)) e[`lift-${i}`] = 'Séries, répétitions ou charge invalides.';
    });
  }
  if (input.race) {
    input.race.segments.forEach((s, i) => {
      if (!s.name.trim()) e[`segment-${i}`] = 'Nom de segment manquant.';
      if (!inRange(s.seconds, 0, 24 * 3600)) e[`segment-${i}`] = 'Temps invalide.';
    });
    if (!inRange(input.race.rank, 1, 100000)) e.race = 'Classement invalide.';
  }
  return e;
}

export function validateBody(entry: BodyEntry, today: string): Errors<BodyEntry> {
  const e: Errors<BodyEntry> = {};
  if (!DATE_RE.test(entry.date) || entry.date > today) e.date = 'Date invalide.';
  if (!inRange(entry.weightKg, 20, 300)) e.weightKg = 'Poids entre 20 et 300 kg.';
  if (!inRange(entry.sleepHours, 0, 24)) e.sleepHours = 'Sommeil entre 0 et 24 h.';
  if (!inRange(entry.restingHr, 25, 150)) e.restingHr = 'FC de repos entre 25 et 150 bpm.';
  if (!inRange(entry.form, 1, 5)) e.form = 'Forme de 1 à 5.';
  const hasValue = [entry.weightKg, entry.sleepHours, entry.restingHr, entry.form].some((v) => v !== undefined) || !!entry.notes?.trim();
  if (!hasValue) e.weightKg = 'Renseigne au moins une mesure.';
  return e;
}

export function validatePlan(plan: Omit<PlannedSession, 'id'>): Errors<PlannedSession> {
  const e: Errors<PlannedSession> = {};
  if (!DATE_RE.test(plan.date)) e.date = 'Date invalide.';
  if (!isSportId(plan.sport)) e.sport = 'Sport inconnu.';
  if (!plan.title.trim()) e.title = 'Donne un titre à la séance.';
  if (!inRange(plan.targetDurationMin, 1, 24 * 60)) e.targetDurationMin = 'Durée invalide.';
  if (!inRange(plan.targetDistanceKm, 0.1, 1000)) e.targetDistanceKm = 'Distance invalide.';
  return e;
}
