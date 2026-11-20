import type { SportCategory, SportId } from './sports';

export const RUN_TYPES = ['footing', 'fractionne', 'sortie-longue', 'tempo', 'competition'] as const;
export type RunType = (typeof RUN_TYPES)[number];
export const RUN_TYPE_LABELS: Record<RunType, string> = {
  footing: 'Footing',
  fractionne: 'Fractionné',
  'sortie-longue': 'Sortie longue',
  tempo: 'Tempo / Seuil',
  competition: 'Compétition',
};

export const WOD_FORMATS = ['for-time', 'amrap', 'emom', 'tabata', 'force', 'autre'] as const;
export type WodFormat = (typeof WOD_FORMATS)[number];
export const WOD_FORMAT_LABELS: Record<WodFormat, string> = {
  'for-time': 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  tabata: 'Tabata',
  force: 'Force / Haltéro',
  autre: 'Autre',
};

export const WOD_LEVELS = ['rx', 'scaled', 'foundations'] as const;
export type WodLevel = (typeof WOD_LEVELS)[number];
export const WOD_LEVEL_LABELS: Record<WodLevel, string> = { rx: 'RX', scaled: 'Scaled', foundations: 'Foundations' };

export interface Lift {
  exercise: string;
  sets: number;
  reps: number;
  weightKg?: number;
}

export interface CrossfitDetails {
  format: WodFormat;
  level: WodLevel;
  /** Nom du WOD (« Fran », « Murph »…) : sert à suivre les benchmarks. */
  wodName?: string;
  /** Contenu de la séance. */
  workout?: string;
  /** Score libre : temps (« 4:32 »), tours + répétitions (« 5+12 »), charge… */
  score?: string;
  lifts?: Lift[];
}

export type SegmentKind = 'run' | 'station' | 'roxzone' | 'other';
export interface Segment {
  name: string;
  kind: SegmentKind;
  seconds?: number;
}

/** Course de fitness (HYROX, ATH X) : entraînement ou compétition, temps par segment. */
export interface RaceDetails {
  official: boolean;
  division?: string;
  segments: Segment[];
  rank?: number;
}

export type ActivitySource = 'manual' | 'gps' | 'import';

/** Une activité. Distances en mètres, durées en secondes (entiers) pour éviter les erreurs d'arrondi. */
export interface Activity {
  id: string;
  sport: SportId;
  /** Date locale AAAA-MM-JJ. */
  date: string;
  /** Heure de début HH:MM (optionnelle). */
  startTime?: string;
  title?: string;
  durationSeconds: number;
  /** Effort perçu de 1 à 10 (échelle CR-10) : sert au calcul de la charge. */
  rpe?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  calories?: number;
  notes?: string;
  // Endurance
  distanceMeters?: number;
  elevationGain?: number;
  runType?: RunType;
  /** Temps par kilomètre (s), issu du GPS. */
  splits?: number[];
  /** Une trace GPS est stockée (IndexedDB) pour cette activité. */
  hasTrack?: boolean;
  // Sports spécifiques
  crossfit?: CrossfitDetails;
  race?: RaceDetails;
  /** Séance planifiée que cette activité réalise. */
  planId?: string;
  source: ActivitySource;
  createdAt: string;
  updatedAt: string;
}

export type ActivityInput = Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>;

/** Mesures quotidiennes (une entrée par date). */
export interface BodyEntry {
  date: string;
  weightKg?: number;
  sleepHours?: number;
  restingHr?: number;
  /** Forme ressentie de 1 (très fatigué) à 5 (en pleine forme). */
  form?: number;
  notes?: string;
}

export type GoalMetric = 'distance' | 'duration' | 'sessions' | 'load';
export type GoalPeriod = 'week' | 'month' | 'year';
/** Une portée d'objectif : toutes activités, une catégorie ou un sport. */
export type GoalScope = 'all' | SportCategory | SportId;

export interface Goal {
  id: string;
  scope: GoalScope;
  metric: GoalMetric;
  period: GoalPeriod;
  /** km, minutes, séances ou points de charge selon `metric`. */
  target: number;
}

export interface PlannedSession {
  id: string;
  date: string;
  sport: SportId;
  title: string;
  description?: string;
  targetDurationMin?: number;
  targetDistanceKm?: number;
  /** Activité réalisée qui correspond à cette séance. */
  activityId?: string;
  /** Programme d'entraînement dont la séance fait partie. */
  program?: ProgramTag;
}

export interface ProgramTag {
  /** Identifiant du programme (catalogue). */
  id: string;
  /** Identifiant de cette inscription au programme (permet de le retirer). */
  instanceId: string;
  name: string;
}

export interface Settings {
  /** Fréquence cardiaque maximale (pour les zones). */
  maxHr?: number;
  /** Adresse du serveur IA (photo du WOD, coach du jour). */
  aiUrl?: string;
  /** Code d'accès du serveur IA. */
  aiCode?: string;
}

export interface AppData {
  version: number;
  activities: Activity[];
  body: BodyEntry[];
  goals: Goal[];
  plans: PlannedSession[];
  settings: Settings;
}
