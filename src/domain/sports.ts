export const SPORT_IDS = ['course', 'trail', 'velo', 'natation', 'marche', 'randonnee', 'crossfit', 'hyrox', 'athx'] as const;
export type SportId = (typeof SPORT_IDS)[number];

/** Les catégories pilotent le formulaire, les statistiques et les couleurs des graphiques. */
export type SportCategory = 'endurance' | 'crossfit' | 'race';

export interface SportInfo {
  id: SportId;
  label: string;
  icon: string;
  category: SportCategory;
  /** Unité d'allure affichée pour les sports d'endurance. */
  paceUnit?: 'min/km' | 'km/h' | 'min/100m';
  /** Le GPS en direct a du sens pour ce sport. */
  gps?: boolean;
}

export const SPORTS: Record<SportId, SportInfo> = {
  course: { id: 'course', label: 'Course à pied', icon: '🏃', category: 'endurance', paceUnit: 'min/km', gps: true },
  trail: { id: 'trail', label: 'Trail', icon: '⛰️', category: 'endurance', paceUnit: 'min/km', gps: true },
  velo: { id: 'velo', label: 'Vélo', icon: '🚴', category: 'endurance', paceUnit: 'km/h', gps: true },
  natation: { id: 'natation', label: 'Natation', icon: '🏊', category: 'endurance', paceUnit: 'min/100m' },
  marche: { id: 'marche', label: 'Marche', icon: '🚶', category: 'endurance', paceUnit: 'min/km', gps: true },
  randonnee: { id: 'randonnee', label: 'Randonnée', icon: '🥾', category: 'endurance', paceUnit: 'km/h', gps: true },
  crossfit: { id: 'crossfit', label: 'CrossFit', icon: '🏋️', category: 'crossfit' },
  hyrox: { id: 'hyrox', label: 'HYROX', icon: '🔥', category: 'race' },
  athx: { id: 'athx', label: 'ATH X', icon: '⚡', category: 'race' },
};

export const CATEGORY_LABELS: Record<SportCategory, string> = {
  endurance: 'Endurance',
  crossfit: 'CrossFit',
  race: 'HYROX / ATH X',
};

/** Ordre fixe des catégories : il détermine aussi leur couleur dans les graphiques. */
export const CATEGORIES: readonly SportCategory[] = ['endurance', 'crossfit', 'race'];

export function sportInfo(id: SportId): SportInfo {
  return SPORTS[id];
}

export function isSportId(value: unknown): value is SportId {
  return typeof value === 'string' && (SPORT_IDS as readonly string[]).includes(value);
}
