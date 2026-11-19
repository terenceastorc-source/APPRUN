import { useCallback, useMemo, useState } from 'react';
import { sortByDateDesc } from '../domain/stats';
import type { Run, RunInput, Settings } from '../domain/types';
import { RunRepository } from '../storage/repository';

export interface RunStore {
  runs: Run[];
  settings: Settings;
  addRun(input: RunInput): Run;
  updateRun(id: string, input: RunInput): Run;
  deleteRun(id: string): void;
  updateSettings(settings: Settings): void;
  importRuns(runs: Run[]): number;
  clearAll(): void;
}

/** Expose le dépôt sous forme d'état React ; chaque mutation persiste puis rafraîchit l'état. */
export function useRunStore(repository?: RunRepository): RunStore {
  const repo = useMemo(() => repository ?? new RunRepository(), [repository]);
  const [runs, setRuns] = useState(() => sortByDateDesc(repo.getRuns()));
  const [settings, setSettings] = useState(() => repo.getSettings());

  const refresh = useCallback(() => {
    setRuns(sortByDateDesc(repo.getRuns()));
    setSettings(repo.getSettings());
  }, [repo]);

  const mutate = useCallback(
    <T,>(fn: () => T): T => {
      const result = fn();
      refresh();
      return result;
    },
    [refresh],
  );

  return {
    runs,
    settings,
    addRun: (input) => mutate(() => repo.add(input)),
    updateRun: (id, input) => mutate(() => repo.update(id, input)),
    deleteRun: (id) => mutate(() => repo.remove(id)),
    updateSettings: (s) => mutate(() => repo.updateSettings(s)),
    importRuns: (list) => mutate(() => repo.importRuns(list)),
    clearAll: () => mutate(() => repo.clear()),
  };
}
