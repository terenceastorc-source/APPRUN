import { isSportId } from '../domain/sports';
import type { Activity, ActivityInput, AppData, BodyEntry, Goal, PlannedSession, Settings } from '../domain/types';

export const STORAGE_KEY = 'apprun:data';
export const SCHEMA_VERSION = 2;

/** Sous-ensemble de l'API Storage, injectable pour les tests. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export function emptyData(): AppData {
  return { version: SCHEMA_VERSION, activities: [], body: [], goals: [], plans: [], settings: {} };
}

/**
 * Base de données locale : un document JSON versionné dans localStorage.
 * Les traces GPS, plus volumineuses, vivent à part dans IndexedDB (voir tracks.ts).
 */
export class Database {
  private data: AppData;

  constructor(
    private readonly store: KeyValueStore = localStorage,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = defaultId,
  ) {
    this.data = this.load();
  }

  snapshot(): AppData {
    return structuredClone(this.data);
  }

  // --- Activités ---
  addActivity(input: ActivityInput): Activity {
    const ts = this.now().toISOString();
    const activity: Activity = { ...cleanActivity(input), id: this.newId(), createdAt: ts, updatedAt: ts };
    this.data.activities.push(activity);
    if (activity.planId) this.linkPlan(activity.planId, activity.id);
    this.save();
    return activity;
  }

  updateActivity(id: string, input: ActivityInput): Activity {
    const i = this.data.activities.findIndex((a) => a.id === id);
    const existing = this.data.activities[i];
    if (!existing) throw new Error(`Activité introuvable : ${id}`);
    const activity: Activity = { ...cleanActivity(input), id, createdAt: existing.createdAt, updatedAt: this.now().toISOString() };
    this.data.activities[i] = activity;
    this.save();
    return activity;
  }

  removeActivity(id: string): void {
    this.data.activities = this.data.activities.filter((a) => a.id !== id);
    // La séance planifiée redevient « à faire ».
    for (const p of this.data.plans) if (p.activityId === id) delete p.activityId;
    this.save();
  }

  // --- Corps : une entrée par date (fusion) ---
  upsertBody(entry: BodyEntry): void {
    const clean = stripEmpty({ ...entry, notes: entry.notes?.trim() || undefined });
    const i = this.data.body.findIndex((b) => b.date === entry.date);
    if (i >= 0) this.data.body[i] = clean;
    else this.data.body.push(clean);
    this.data.body.sort((a, b) => a.date.localeCompare(b.date));
    this.save();
  }

  removeBody(date: string): void {
    this.data.body = this.data.body.filter((b) => b.date !== date);
    this.save();
  }

  // --- Objectifs ---
  addGoal(goal: Omit<Goal, 'id'>): Goal {
    const g = { ...goal, id: this.newId() };
    this.data.goals.push(g);
    this.save();
    return g;
  }

  removeGoal(id: string): void {
    this.data.goals = this.data.goals.filter((g) => g.id !== id);
    this.save();
  }

  // --- Plan ---
  addPlan(plan: Omit<PlannedSession, 'id'>): PlannedSession {
    const p = stripEmpty({ ...plan, id: this.newId(), description: plan.description?.trim() || undefined });
    this.data.plans.push(p);
    this.save();
    return p;
  }

  updatePlan(id: string, plan: Omit<PlannedSession, 'id'>): void {
    const i = this.data.plans.findIndex((p) => p.id === id);
    if (i < 0) throw new Error(`Séance introuvable : ${id}`);
    this.data.plans[i] = stripEmpty({ ...plan, id, description: plan.description?.trim() || undefined });
    this.save();
  }

  removePlan(id: string): void {
    this.data.plans = this.data.plans.filter((p) => p.id !== id);
    for (const a of this.data.activities) if (a.planId === id) delete a.planId;
    this.save();
  }

  private linkPlan(planId: string, activityId: string) {
    const plan = this.data.plans.find((p) => p.id === planId);
    if (plan) plan.activityId = activityId;
  }

  updateSettings(settings: Settings): void {
    this.data.settings = stripEmpty({ ...settings });
    this.save();
  }

  /** Remplace ou fusionne avec des données importées. Retourne le nombre d'activités importées. */
  importData(incoming: AppData, mode: 'merge' | 'replace'): number {
    if (mode === 'replace') this.data = structuredClone(incoming);
    else {
      const mergeBy = <T,>(a: T[], b: T[], key: (x: T) => string) => [...new Map([...a, ...b].map((x) => [key(x), x])).values()];
      this.data = {
        version: SCHEMA_VERSION,
        activities: mergeBy(this.data.activities, incoming.activities, (x) => x.id),
        body: mergeBy(this.data.body, incoming.body, (x) => x.date).sort((a, b) => a.date.localeCompare(b.date)),
        goals: mergeBy(this.data.goals, incoming.goals, (x) => x.id),
        plans: mergeBy(this.data.plans, incoming.plans, (x) => x.id),
        settings: { ...this.data.settings, ...incoming.settings },
      };
    }
    this.save();
    return incoming.activities.length;
  }

  clear(): void {
    this.data = emptyData();
    this.save();
  }

  private load(): AppData {
    let raw: string | null;
    try {
      raw = this.store.getItem(STORAGE_KEY);
    } catch {
      return emptyData();
    }
    if (!raw) return emptyData();
    try {
      return migrate(JSON.parse(raw));
    } catch {
      // Données illisibles : on repart de zéro plutôt que de bloquer l'app.
      return emptyData();
    }
  }

  private save(): void {
    this.store.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}

/** Format v1 (application « course » d'origine). */
interface V1Run {
  id: string;
  date: string;
  distanceMeters: number;
  durationSeconds: number;
  type: string;
  effort?: number;
  heartRateAvg?: number;
  elevationGain?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Convertit n'importe quelle version connue vers le schéma courant. */
export function migrate(raw: unknown): AppData {
  if (typeof raw !== 'object' || raw === null) return emptyData();
  const r = raw as Record<string, unknown>;
  const version = typeof r.version === 'number' ? r.version : 1;

  if (version < 2) {
    const runs = Array.isArray(r.runs) ? (r.runs as V1Run[]) : [];
    const activities: Activity[] = runs
      .filter((x) => x && typeof x.id === 'string' && typeof x.date === 'string' && x.distanceMeters > 0 && x.durationSeconds > 0)
      .map((x) =>
        stripEmpty({
          id: x.id,
          // v1 avait un type « trail » parmi les types de course : c'est désormais un sport.
          sport: x.type === 'trail' ? ('trail' as const) : ('course' as const),
          runType: x.type !== 'trail' && ['footing', 'fractionne', 'sortie-longue', 'tempo', 'competition'].includes(x.type) ? (x.type as Activity['runType']) : undefined,
          date: x.date,
          distanceMeters: x.distanceMeters,
          durationSeconds: x.durationSeconds,
          // Ressenti 1–5 → effort perçu 1–10.
          rpe: x.effort ? x.effort * 2 : undefined,
          heartRateAvg: x.heartRateAvg,
          elevationGain: x.elevationGain,
          notes: x.notes,
          source: 'manual' as const,
          createdAt: x.createdAt,
          updatedAt: x.updatedAt,
        }),
      );
    const weeklyGoalKm = (r.settings as { weeklyGoalKm?: number } | undefined)?.weeklyGoalKm;
    const goals: Goal[] = weeklyGoalKm ? [{ id: 'migrated-weekly-km', scope: 'course', metric: 'distance', period: 'week', target: weeklyGoalKm }] : [];
    return { ...emptyData(), activities, goals };
  }

  const list = <T,>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : []);
  return {
    version: SCHEMA_VERSION,
    activities: list(r.activities, isValidActivity),
    body: list(r.body, (x): x is BodyEntry => typeof x === 'object' && x !== null && typeof (x as BodyEntry).date === 'string'),
    goals: list(r.goals, (x): x is Goal => typeof x === 'object' && x !== null && typeof (x as Goal).id === 'string' && typeof (x as Goal).target === 'number'),
    plans: list(r.plans, (x): x is PlannedSession => typeof x === 'object' && x !== null && typeof (x as PlannedSession).id === 'string' && isSportId((x as PlannedSession).sport)),
    settings: typeof r.settings === 'object' && r.settings !== null ? (r.settings as Settings) : {},
  };
}

export function isValidActivity(value: unknown): value is Activity {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    isSportId(a.sport) &&
    typeof a.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(a.date) &&
    typeof a.durationSeconds === 'number' &&
    a.durationSeconds > 0
  );
}

function cleanActivity(input: ActivityInput): ActivityInput {
  const notes = input.notes?.trim();
  const title = input.title?.trim();
  const out = stripEmpty({ ...input, notes: notes || undefined, title: title || undefined });
  if (out.crossfit) {
    out.crossfit = stripEmpty({
      ...out.crossfit,
      wodName: out.crossfit.wodName?.trim() || undefined,
      workout: out.crossfit.workout?.trim() || undefined,
      score: out.crossfit.score?.trim() || undefined,
      lifts: out.crossfit.lifts?.length ? out.crossfit.lifts.map((l) => stripEmpty({ ...l, exercise: l.exercise.trim() })) : undefined,
    });
  }
  if (out.race) out.race = stripEmpty({ ...out.race, segments: out.race.segments.map((s) => stripEmpty({ ...s, name: s.name.trim() })) });
  return out;
}

/** Retire les clés `undefined` pour garder un stockage compact et des comparaisons simples. */
export function stripEmpty<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function defaultId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
