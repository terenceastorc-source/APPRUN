import { addDays, parseLocalDate, startOfWeek, toIsoDate } from './format';
import type { SportId } from './sports';
import type { PlannedSession } from './types';

export const LEVELS = ['debutant', 'intermediaire', 'confirme'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABELS: Record<Level, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', confirme: 'Confirmé' };

/** Séance type d'un programme. `day` : 0 = lundi … 6 = dimanche. */
export interface TemplateSession {
  day: number;
  sport: SportId;
  title: string;
  description: string;
  durationMin?: number;
  distanceKm?: number;
}

export interface ProgramDef {
  id: string;
  name: string;
  icon: string;
  summary: string;
  weeks: number;
  /** Sport de l'épreuve finale (séance « Jour J »), si le programme vise une course. */
  raceSport?: SportId;
  raceTitle?: string;
  /** Séances semaine par semaine selon le niveau. */
  build(level: Level): TemplateSession[][];
}

/** Coefficient de volume selon le niveau. */
const VOLUME: Record<Level, number> = { debutant: 0.75, intermediaire: 1, confirme: 1.25 };
const reps = (n: number, level: Level) => Math.max(3, Math.round(n * (level === 'debutant' ? 0.7 : level === 'confirme' ? 1.2 : 1)));
const km = (n: number, level: Level) => Math.round(n * VOLUME[level] * 2) / 2;
const min = (n: number, level: Level) => Math.round((n * VOLUME[level]) / 5) * 5;

// --- 10 km : 8 semaines ---
const TEN_K_INTERVALS: [number, string, string][] = [
  [6, '400 m', 'allure 5 km, récup 1 min 30 trot'],
  [5, '800 m', 'allure 5–10 km, récup 2 min'],
  [3, '1 500 m', 'allure 10 km, récup 2 min'],
  [0, '', ''],
  [6, '1 000 m', 'allure 10 km, récup 1 min 30'],
  [4, '2 000 m', 'allure 10 km, récup 2 min'],
  [8, '400 m', 'vif, récup 1 min'],
  [3, '1 000 m', 'allure course, récup 2 min'],
];
const TEN_K_LONG = [7, 8, 9, 7, 10, 11, 9, 0];

const tenK: ProgramDef = {
  id: '10k',
  name: 'Objectif 10 km',
  icon: '🏃',
  summary: '8 semaines, 3 à 4 sorties : fractionné, footing/tempo et sortie longue. Semaine 4 allégée, dernière semaine d’affûtage.',
  weeks: 8,
  raceSport: 'course',
  raceTitle: 'Course 10 km 🏁',
  build(level) {
    return TEN_K_INTERVALS.map(([n, dist, how], w) => {
      const deload = w === 3;
      const taper = w === 7;
      const week: TemplateSession[] = [];
      week.push(
        deload
          ? { day: 1, sport: 'course', title: 'Footing + lignes droites', description: '30 min facile puis 6 × 80 m en accélération progressive.', durationMin: min(40, level) }
          : {
              day: 1,
              sport: 'course',
              title: `${reps(n, level)} × ${dist}`,
              description: `Échauffement 20 min, ${reps(n, level)} × ${dist} ${how}, retour au calme 10 min.`,
              durationMin: min(55, level),
            },
      );
      week.push(
        w === 4 || w === 5
          ? { day: 3, sport: 'course', title: 'Tempo', description: `15 min facile, ${level === 'debutant' ? 15 : 20} min allure semi-marathon, 10 min facile.`, durationMin: min(50, level) }
          : { day: 3, sport: 'course', title: 'Footing', description: 'Allure facile, tu dois pouvoir parler.', durationMin: min(taper ? 30 : 45, level) },
      );
      if (level === 'confirme' && !taper) week.push({ day: 5, sport: 'course', title: 'Footing récupération', description: 'Très facile.', durationMin: 35 });
      if (!taper) week.push({ day: 6, sport: 'course', title: 'Sortie longue', description: 'Allure facile et régulière. Termine les 2 derniers km un peu plus vite si tu te sens bien.', distanceKm: km(TEN_K_LONG[w]!, level) });
      return week;
    });
  },
};

// --- Semi-marathon : 10 semaines ---
const SEMI_LONG = [10, 12, 13, 10, 14, 15, 16, 12, 17, 0];
const SEMI_QUALITY: [string, string][] = [
  ['6 × 1 000 m', 'allure 10 km, récup 1 min 30'],
  ['3 × 2 000 m', 'allure semi, récup 2 min'],
  ['5 × 1 200 m', 'allure 10 km, récup 1 min 30'],
  ['', ''],
  ['3 × 3 000 m', 'allure semi, récup 2 min'],
  ['8 × 600 m', 'allure 5 km, récup 1 min'],
  ['2 × 5 000 m', 'allure semi, récup 3 min'],
  ['', ''],
  ['4 × 2 000 m', 'allure semi, récup 1 min 30'],
  ['3 × 1 000 m', 'allure semi, récup 2 min'],
];

const semi: ProgramDef = {
  id: 'semi',
  name: 'Objectif semi-marathon',
  icon: '🏅',
  summary: '10 semaines, 4 sorties : qualité, footing, tempo et sortie longue jusqu’à 17 km (intermédiaire). Semaines 4 et 8 allégées.',
  weeks: 10,
  raceSport: 'course',
  raceTitle: 'Semi-marathon 🏁',
  build(level) {
    return SEMI_QUALITY.map(([title, how], w) => {
      const deload = w === 3 || w === 7;
      const taper = w === 9;
      const week: TemplateSession[] = [];
      week.push(
        deload || !title
          ? { day: 1, sport: 'course', title: 'Footing + lignes droites', description: '35 min facile puis 6 × 80 m.', durationMin: min(45, level) }
          : { day: 1, sport: 'course', title, description: `Échauffement 20 min, ${title} ${how}, retour au calme 10 min.`, durationMin: min(65, level) },
      );
      if (level !== 'debutant' || !taper) week.push({ day: 2, sport: 'course', title: 'Footing', description: 'Allure facile.', durationMin: min(taper ? 30 : 45, level) });
      if (!taper)
        week.push(
          deload
            ? { day: 4, sport: 'course', title: 'Footing', description: 'Allure facile.', durationMin: min(40, level) }
            : { day: 4, sport: 'course', title: 'Tempo', description: `15 min facile, ${min(25, level)} min allure seuil (confortablement difficile), 10 min facile.`, durationMin: min(55, level) },
        );
      if (!taper) week.push({ day: 6, sport: 'course', title: 'Sortie longue', description: 'Allure facile. Bois et mange comme le jour de la course.', distanceKm: km(SEMI_LONG[w]!, level) });
      return week;
    });
  },
};

// --- HYROX : 8 semaines ---
const HYROX_COMPROMISED = [
  '4 × (1 km course + 500 m SkiErg)',
  '4 × (1 km course + 20 Wall Balls + 20 m Sled Push)',
  '5 × (1 km course + 500 m rameur)',
  '3 × (1 km course facile + 1 atelier au choix technique)',
  '5 × (1 km course + 40 m Farmers Carry + 20 Burpee Broad Jumps)',
  '6 × (1 km course + 1 atelier au choix)',
  '4 × (1 km course + 25 Wall Balls)',
  '3 × (1 km allure course + 1 atelier léger)',
];

const hyrox: ProgramDef = {
  id: 'hyrox',
  name: 'Préparation HYROX',
  icon: '🔥',
  summary: '8 semaines, 4 séances : force, course compromise (course + atelier), endurance et WOD/simulation. Demi-simulation en semaine 3, simulation complète en semaine 6.',
  weeks: 8,
  raceSport: 'hyrox',
  raceTitle: 'Course HYROX 🏁',
  build(level) {
    return HYROX_COMPROMISED.map((compromised, w) => {
      const deload = w === 3;
      const taper = w === 7;
      const sets = level === 'debutant' ? 3 : level === 'confirme' ? 5 : 4;
      const week: TemplateSession[] = [];
      week.push({
        day: 0,
        sport: 'crossfit',
        title: deload || taper ? 'Force (allégée)' : 'Force jambes + gainage',
        description: `${deload || taper ? 2 : sets} × 6 Back Squat, ${deload || taper ? 2 : sets} × 10 fentes marchées, 3 × 45 s gainage. Charges ${deload || taper ? 'modérées' : 'lourdes mais propres'}.`,
        durationMin: 60,
      });
      week.push({ day: 2, sport: 'hyrox', title: 'Course compromise', description: `${compromised}. Garde une allure de course régulière malgré la fatigue de l'atelier.`, durationMin: min(55, level) });
      week.push(
        w % 2 === 0
          ? { day: 4, sport: 'course', title: 'Endurance', description: 'Footing en aisance respiratoire (zone 2).', durationMin: min(taper ? 30 : 50, level) }
          : { day: 4, sport: 'course', title: '8 × 400 m', description: 'Allure rapide, récup 1 min. Travaille ton allure de course HYROX.', durationMin: min(45, level) },
      );
      if (!taper)
        week.push(
          w === 2
            ? { day: 5, sport: 'hyrox', title: 'Demi-simulation HYROX', description: '4 × (1 km + 1 atelier) avec les ateliers 1 à 4 aux charges de ta division. Note tes temps par segment.', durationMin: 50 }
            : w === 5
              ? { day: 5, sport: 'hyrox', title: 'Simulation HYROX complète', description: '8 × (1 km + atelier) dans l’ordre officiel. Note tes temps par segment pour repérer ton point faible.', durationMin: 90 }
              : { day: 5, sport: 'crossfit', title: deload ? 'WOD léger' : 'WOD HYROX', description: deload ? 'AMRAP 15 min modéré : 10 Wall Balls, 10 Burpees, 250 m rameur.' : 'AMRAP 25 min : 500 m rameur, 20 Wall Balls, 15 Burpee Broad Jumps, 40 m Farmers Carry.', durationMin: deload ? 35 : 50 },
        );
      return week;
    });
  },
};

// --- CrossFit : 6 semaines ---
const SQUAT_PCT = [70, 72.5, 75, 65, 80, 0];
const SKILLS = ['Double unders', 'Toes to bar', 'Pull-ups kipping', 'Handstand (gainage)', 'Muscle-up (éducatifs)', ''];

const crossfit: ProgramDef = {
  id: 'crossfit-base',
  name: 'Base CrossFit',
  icon: '🏋️',
  summary: '6 semaines, 3 séances : force (Back Squat en %), technique gymnique et metcon. Benchmarks Fran et Cindy testés en semaine 1 et retestés en semaine 6.',
  weeks: 6,
  build(level) {
    return SQUAT_PCT.map((pct, w) => {
      const test = w === 0 || w === 5;
      const rx = level === 'confirme' ? 'RX' : level === 'intermediaire' ? 'RX ou Scaled' : 'Scaled';
      const week: TemplateSession[] = [];
      week.push(
        w === 5
          ? { day: 0, sport: 'crossfit', title: 'Test 1RM Back Squat', description: 'Montée progressive jusqu’à ton maximum du jour. Note la charge dans « Force ».', durationMin: 60 }
          : { day: 0, sport: 'crossfit', title: `Back Squat 5 × 5 @ ${pct} %`, description: `5 séries de 5 à ${pct} % de ton 1RM, puis metcon court : EMOM 10 min (8 Kettlebell Swings + 6 Burpees).`, durationMin: 60 },
      );
      week.push(
        test
          ? { day: 2, sport: 'crossfit', title: 'Benchmark Fran', description: `21-15-9 Thrusters / Pull-ups, ${rx}. Nomme le WOD « Fran » pour suivre ta progression.`, durationMin: 30 }
          : { day: 2, sport: 'crossfit', title: `Technique : ${SKILLS[w]}`, description: `15 min de travail technique ${SKILLS[w]}, puis For Time : 3 tours de 400 m course, 15 Wall Balls, 10 Toes to bar.`, durationMin: 55 },
      );
      week.push(
        test
          ? { day: 4, sport: 'crossfit', title: 'Benchmark Cindy', description: `AMRAP 20 min : 5 Pull-ups, 10 Push-ups, 15 Air Squats, ${rx}. Nomme le WOD « Cindy ».`, durationMin: 30 }
          : { day: 4, sport: 'crossfit', title: 'Metcon', description: w === 3 ? 'Semaine allégée : AMRAP 12 min modéré.' : 'AMRAP 16 min : 12 Deadlifts, 9 Hang Power Cleans, 6 Push Jerks (charge modérée).', durationMin: 50 },
      );
      if (level === 'confirme' && !test) week.push({ day: 5, sport: 'course', title: 'Cardio', description: '30 min de course ou rameur en zone 2.', durationMin: 30 });
      return week;
    });
  },
};

export const PROGRAMS: ProgramDef[] = [tenK, semi, hyrox, crossfit];

export function programById(id: string): ProgramDef | undefined {
  return PROGRAMS.find((p) => p.id === id);
}

export interface ProgramPlan {
  start: string;
  sessions: Omit<PlannedSession, 'id'>[];
}

/**
 * Place le programme dans le calendrier.
 * Avec une date de course : la dernière semaine du programme contient la course.
 * Sans : démarrage le lundi qui suit `today` (ou aujourd'hui si c'est lundi).
 */
export function scheduleProgram(def: ProgramDef, level: Level, opts: { raceDate?: string; today: Date; instanceId: string }): ProgramPlan | { error: string } {
  const todayMonday = startOfWeek(opts.today);
  let start: Date;
  if (opts.raceDate) {
    start = addDays(startOfWeek(parseLocalDate(opts.raceDate)), -7 * (def.weeks - 1));
    if (start < todayMonday) {
      const weeksLeft = Math.floor((startOfWeek(parseLocalDate(opts.raceDate)).getTime() - todayMonday.getTime()) / (7 * 86400000)) + 1;
      return { error: `Il faut ${def.weeks} semaines pour ce programme : la course est dans ${weeksLeft} semaine${weeksLeft > 1 ? 's' : ''}. Choisis une date plus lointaine.` };
    }
  } else {
    start = opts.today.getDay() === 1 ? todayMonday : addDays(todayMonday, 7);
  }
  const startIso = toIsoDate(start);
  const name = `${def.name} · ${LEVEL_LABELS[level]}`;
  const tag = { id: def.id, instanceId: opts.instanceId, name };
  const sessions: Omit<PlannedSession, 'id'>[] = [];
  def.build(level).forEach((week, w) => {
    for (const s of week) {
      const date = toIsoDate(addDays(start, w * 7 + s.day));
      // Ne rien planifier après la course.
      if (opts.raceDate && date >= opts.raceDate) continue;
      sessions.push({
        date,
        sport: s.sport,
        title: s.title,
        description: `S${w + 1} · ${s.description}`,
        targetDurationMin: s.durationMin,
        targetDistanceKm: s.distanceKm,
        program: tag,
      });
    }
  });
  if (opts.raceDate && def.raceSport) {
    sessions.push({ date: opts.raceDate, sport: def.raceSport, title: def.raceTitle ?? 'Jour J 🏁', description: 'Objectif du programme. Bonne course !', program: tag });
  }
  return { start: startIso, sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)) };
}

export interface ProgramProgress {
  instanceId: string;
  programId: string;
  name: string;
  total: number;
  done: number;
  /** Séances passées non réalisées. */
  missed: number;
  start: string;
  end: string;
  next?: PlannedSession;
}

/** Programmes présents dans le calendrier et leur avancement. */
export function activePrograms(plans: readonly PlannedSession[], today: string): ProgramProgress[] {
  const groups = new Map<string, PlannedSession[]>();
  for (const p of plans) if (p.program) groups.set(p.program.instanceId, [...(groups.get(p.program.instanceId) ?? []), p]);
  return [...groups.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const tag = sorted[0]!.program!;
      return {
        instanceId: tag.instanceId,
        programId: tag.id,
        name: tag.name,
        total: sorted.length,
        done: sorted.filter((p) => p.activityId).length,
        missed: sorted.filter((p) => !p.activityId && p.date < today).length,
        start: sorted[0]!.date,
        end: sorted[sorted.length - 1]!.date,
        next: sorted.find((p) => !p.activityId && p.date >= today),
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}
