export const RUN_TYPES = ['footing', 'fractionne', 'sortie-longue', 'tempo', 'competition', 'trail'] as const;
export type RunType = (typeof RUN_TYPES)[number];

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  footing: 'Footing',
  fractionne: 'Fractionné',
  'sortie-longue': 'Sortie longue',
  tempo: 'Tempo / Seuil',
  competition: 'Compétition',
  trail: 'Trail',
};

/** Une sortie enregistrée. Distances en mètres, durées en secondes pour éviter les erreurs d'arrondi. */
export interface Run {
  id: string;
  /** Date locale au format AAAA-MM-JJ. */
  date: string;
  distanceMeters: number;
  durationSeconds: number;
  type: RunType;
  /** Ressenti de 1 (très facile) à 5 (épuisant). */
  effort?: number;
  heartRateAvg?: number;
  elevationGain?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type RunInput = Omit<Run, 'id' | 'createdAt' | 'updatedAt'>;

export interface Settings {
  /** Objectif hebdomadaire en kilomètres (0 = pas d'objectif). */
  weeklyGoalKm: number;
}

export const DEFAULT_SETTINGS: Settings = { weeklyGoalKm: 20 };
