/**
 * Contrat entre l'application et le serveur IA.
 * Sans dépendance (ni React, ni SDK) : importé par l'app ET par le worker.
 */

export const WOD_FORMAT_VALUES = ['for-time', 'amrap', 'emom', 'tabata', 'force', 'autre'] as const;
export const SPORT_VALUES = ['course', 'trail', 'velo', 'natation', 'marche', 'randonnee', 'crossfit', 'hyrox', 'athx'] as const;

// --- Photo du WOD ---

export interface WodPhotoRequest {
  /** Image JPEG/PNG/WebP encodée en base64 (sans préfixe data:). */
  image: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface WodExtraction {
  /** false si la photo ne contient pas de séance lisible. */
  readable: boolean;
  title: string;
  format: (typeof WOD_FORMAT_VALUES)[number];
  /** Nom du benchmark reconnu (« Fran », « Murph »…) ou chaîne vide. */
  wodName: string;
  /** Durée du bloc pour AMRAP/EMOM/Tabata, ou time cap pour un For Time (0 = inconnu). */
  durationMinutes: number;
  /** Séance propre, un mouvement par ligne. */
  workout: string;
  lifts: { exercise: string; sets: number; reps: number; weightKg: number }[];
  /** Remarque pour l'athlète (passage illisible, choix d'interprétation…), ou chaîne vide. */
  note: string;
  confidence: 'haute' | 'moyenne' | 'faible';
}

/** Schéma JSON imposé à Claude (sorties structurées). */
export const WOD_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean' },
    title: { type: 'string' },
    format: { type: 'string', enum: [...WOD_FORMAT_VALUES] },
    wodName: { type: 'string' },
    durationMinutes: { type: 'number' },
    workout: { type: 'string' },
    lifts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { exercise: { type: 'string' }, sets: { type: 'integer' }, reps: { type: 'integer' }, weightKg: { type: 'number' } },
        required: ['exercise', 'sets', 'reps', 'weightKg'],
        additionalProperties: false,
      },
    },
    note: { type: 'string' },
    confidence: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
  },
  required: ['readable', 'title', 'format', 'wodName', 'durationMinutes', 'workout', 'lifts', 'note', 'confidence'],
  additionalProperties: false,
} as const;

// --- Coach du jour ---

export interface CoachRequest {
  /** Contexte d'entraînement résumé par l'app (voir src/ai/coachContext.ts). */
  context: CoachContext;
  /** Message libre de l'athlète (« 30 min dispo, mal au mollet »). */
  note: string;
}

export interface CoachContext {
  today: string;
  weekday: string;
  profile: { maxHr?: number };
  load: { acute7d: number; chronicWeekly: number; ratio: number | null; status: string };
  recentSessions: { date: string; sport: string; title: string; minutes: number; km?: number; rpe?: number; detail?: string }[];
  body: { date: string; weightKg?: number; sleepHours?: number; restingHr?: number; form?: number; notes?: string }[];
  planned: { date: string; sport: string; title: string; description?: string; minutes?: number; km?: number; program?: string }[];
  goals: { label: string; progress: string }[];
}

export interface CoachAdvice {
  /** go : séance prévue OK ; adapt : séance modifiée ; rest : repos/récupération. */
  status: 'go' | 'adapt' | 'rest';
  headline: string;
  analysis: string;
  session: {
    sport: (typeof SPORT_VALUES)[number];
    title: string;
    durationMinutes: number;
    intensity: 'récupération' | 'facile' | 'modérée' | 'difficile';
    description: string;
  };
  tips: string[];
}

export const COACH_ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['go', 'adapt', 'rest'] },
    headline: { type: 'string' },
    analysis: { type: 'string' },
    session: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: [...SPORT_VALUES] },
        title: { type: 'string' },
        durationMinutes: { type: 'integer' },
        intensity: { type: 'string', enum: ['récupération', 'facile', 'modérée', 'difficile'] },
        description: { type: 'string' },
      },
      required: ['sport', 'title', 'durationMinutes', 'intensity', 'description'],
      additionalProperties: false,
    },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'headline', 'analysis', 'session', 'tips'],
  additionalProperties: false,
} as const;

// --- Erreurs ---

export interface ApiError {
  error: { code: 'unauthorized' | 'bad_request' | 'too_large' | 'refused' | 'upstream' | 'not_found'; message: string };
}

/** Garde-fous côté app : la réponse a la forme attendue (le serveur peut être une ancienne version). */
export function isWodExtraction(v: unknown): v is WodExtraction {
  const o = v as WodExtraction;
  return (
    typeof o === 'object' &&
    o !== null &&
    typeof o.readable === 'boolean' &&
    typeof o.title === 'string' &&
    (WOD_FORMAT_VALUES as readonly string[]).includes(o.format) &&
    typeof o.workout === 'string' &&
    Array.isArray(o.lifts)
  );
}

export function isCoachAdvice(v: unknown): v is CoachAdvice {
  const o = v as CoachAdvice;
  return (
    typeof o === 'object' &&
    o !== null &&
    ['go', 'adapt', 'rest'].includes(o.status) &&
    typeof o.headline === 'string' &&
    typeof o.session === 'object' &&
    o.session !== null &&
    (SPORT_VALUES as readonly string[]).includes(o.session.sport) &&
    Array.isArray(o.tips)
  );
}
