import { DEFAULT_SETTINGS, type Run, type RunInput, type Settings } from '../domain/types';
import { isRunType } from '../domain/validation';

const STORAGE_KEY = 'apprun:data';
const SCHEMA_VERSION = 1;

interface StoredData {
  version: number;
  runs: Run[];
  settings: Settings;
}

/** Sous-ensemble de l'API Storage, injectable pour les tests. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export class RunRepository {
  private data: StoredData;

  constructor(
    private readonly store: KeyValueStore = localStorage,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = defaultId,
  ) {
    this.data = this.load();
  }

  getRuns(): Run[] {
    return [...this.data.runs];
  }

  getSettings(): Settings {
    return { ...this.data.settings };
  }

  add(input: RunInput): Run {
    const ts = this.now().toISOString();
    const run: Run = { ...clean(input), id: this.newId(), createdAt: ts, updatedAt: ts };
    this.data.runs.push(run);
    this.save();
    return run;
  }

  update(id: string, input: RunInput): Run {
    const index = this.data.runs.findIndex((r) => r.id === id);
    const existing = this.data.runs[index];
    if (!existing) throw new Error(`Course introuvable : ${id}`);
    const run: Run = { ...clean(input), id, createdAt: existing.createdAt, updatedAt: this.now().toISOString() };
    this.data.runs[index] = run;
    this.save();
    return run;
  }

  remove(id: string): void {
    this.data.runs = this.data.runs.filter((r) => r.id !== id);
    this.save();
  }

  updateSettings(settings: Settings): void {
    this.data.settings = { ...settings };
    this.save();
  }

  /** Fusionne des courses importées ; les identifiants déjà présents sont remplacés. Retourne le nombre importé. */
  importRuns(runs: Run[]): number {
    const byId = new Map(this.data.runs.map((r) => [r.id, r]));
    for (const r of runs) byId.set(r.id, r);
    this.data.runs = [...byId.values()];
    this.save();
    return runs.length;
  }

  clear(): void {
    this.data = emptyData();
    this.save();
  }

  private load(): StoredData {
    let raw: string | null = null;
    try {
      raw = this.store.getItem(STORAGE_KEY);
    } catch {
      return emptyData();
    }
    if (!raw) return emptyData();
    try {
      const parsed = JSON.parse(raw) as Partial<StoredData>;
      return migrate(parsed);
    } catch {
      // Données corrompues : on repart de zéro plutôt que de planter l'app.
      return emptyData();
    }
  }

  private save(): void {
    this.store.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}

function emptyData(): StoredData {
  return { version: SCHEMA_VERSION, runs: [], settings: { ...DEFAULT_SETTINGS } };
}

function migrate(parsed: Partial<StoredData>): StoredData {
  // Point d'extension : appliquer ici les migrations quand SCHEMA_VERSION évoluera.
  return {
    version: SCHEMA_VERSION,
    runs: Array.isArray(parsed.runs) ? parsed.runs.filter(isValidRun) : [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
  };
}

export function isValidRun(value: unknown): value is Run {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    typeof r.distanceMeters === 'number' &&
    r.distanceMeters > 0 &&
    typeof r.durationSeconds === 'number' &&
    r.durationSeconds > 0 &&
    isRunType(r.type)
  );
}

/** Supprime les champs optionnels vides pour garder un stockage propre. */
function clean(input: RunInput): RunInput {
  const out: RunInput = { date: input.date, distanceMeters: input.distanceMeters, durationSeconds: input.durationSeconds, type: input.type };
  if (input.effort !== undefined) out.effort = input.effort;
  if (input.heartRateAvg !== undefined) out.heartRateAvg = input.heartRateAvg;
  if (input.elevationGain !== undefined) out.elevationGain = input.elevationGain;
  const notes = input.notes?.trim();
  if (notes) out.notes = notes;
  return out;
}

function defaultId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
