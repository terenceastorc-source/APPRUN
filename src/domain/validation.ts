import { RUN_TYPES, type RunInput, type RunType } from './types';

export type ValidationErrors = Partial<Record<keyof RunInput, string>>;

const MAX_DISTANCE_M = 500_000; // 500 km
const MAX_DURATION_S = 7 * 24 * 3600;

export function validateRun(input: RunInput, today: string): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.date = 'Date invalide.';
  else if (input.date > today) errors.date = 'La date ne peut pas être dans le futur.';

  if (!Number.isFinite(input.distanceMeters) || input.distanceMeters <= 0) errors.distanceMeters = 'Indique une distance positive (en km).';
  else if (input.distanceMeters > MAX_DISTANCE_M) errors.distanceMeters = 'Distance trop grande.';

  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) errors.durationSeconds = 'Durée invalide (ex. 45:30 ou 1:05:00).';
  else if (input.durationSeconds > MAX_DURATION_S) errors.durationSeconds = 'Durée trop longue.';

  if (!RUN_TYPES.includes(input.type)) errors.type = 'Type de sortie inconnu.';
  if (input.effort !== undefined && (!Number.isInteger(input.effort) || input.effort < 1 || input.effort > 5))
    errors.effort = 'Le ressenti va de 1 à 5.';
  if (input.heartRateAvg !== undefined && !inRange(input.heartRateAvg, 30, 250))
    errors.heartRateAvg = 'Fréquence cardiaque entre 30 et 250 bpm.';
  if (input.elevationGain !== undefined && !inRange(input.elevationGain, 0, 20000))
    errors.elevationGain = 'Dénivelé entre 0 et 20 000 m.';
  return errors;
}

export function isRunType(value: unknown): value is RunType {
  return typeof value === 'string' && (RUN_TYPES as readonly string[]).includes(value);
}

/** Faux pour NaN, contrairement à une simple double comparaison. */
function inRange(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && n >= min && n <= max;
}
