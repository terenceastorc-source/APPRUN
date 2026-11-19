import type { Run } from '../domain/types';

let seq = 0;
export function makeRun(overrides: Partial<Run> = {}): Run {
  seq++;
  return {
    id: `run-${seq}`,
    date: '2026-11-16',
    distanceMeters: 10000,
    durationSeconds: 3000,
    type: 'footing',
    createdAt: `2026-11-16T08:00:${String(seq % 60).padStart(2, '0')}.000Z`,
    updatedAt: '2026-11-16T08:00:00.000Z',
    ...overrides,
  };
}

/** Stockage clé/valeur en mémoire pour isoler les tests du localStorage. */
export function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}
