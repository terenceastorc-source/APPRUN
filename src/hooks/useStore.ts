import { useCallback, useMemo, useState } from 'react';
import { sortByDateDesc } from '../domain/stats';
import type { Activity, ActivityInput, AppData, BodyEntry, Goal, PlannedSession, Settings } from '../domain/types';
import { Database } from '../storage/database';

export interface Store {
  data: AppData;
  /** Activités triées de la plus récente à la plus ancienne. */
  activities: Activity[];
  addActivity(input: ActivityInput): Activity;
  updateActivity(id: string, input: ActivityInput): Activity;
  removeActivity(id: string): void;
  upsertBody(entry: BodyEntry): void;
  removeBody(date: string): void;
  addGoal(goal: Omit<Goal, 'id'>): void;
  removeGoal(id: string): void;
  addPlan(plan: Omit<PlannedSession, 'id'>): void;
  updatePlan(id: string, plan: Omit<PlannedSession, 'id'>): void;
  removePlan(id: string): void;
  updateSettings(settings: Settings): void;
  importData(data: AppData, mode: 'merge' | 'replace'): number;
  clear(): void;
}

/** Relie la base locale à l'état React : chaque mutation persiste puis rafraîchit l'instantané. */
export function useStore(database?: Database): Store {
  const db = useMemo(() => database ?? new Database(), [database]);
  const [data, setData] = useState(() => db.snapshot());
  const activities = useMemo(() => sortByDateDesc(data.activities), [data.activities]);

  const mutate = useCallback(
    <T,>(fn: () => T): T => {
      const result = fn();
      setData(db.snapshot());
      return result;
    },
    [db],
  );

  return useMemo(
    () => ({
      data,
      activities,
      addActivity: (i) => mutate(() => db.addActivity(i)),
      updateActivity: (id, i) => mutate(() => db.updateActivity(id, i)),
      removeActivity: (id) => mutate(() => db.removeActivity(id)),
      upsertBody: (e) => mutate(() => db.upsertBody(e)),
      removeBody: (d) => mutate(() => db.removeBody(d)),
      addGoal: (g) => mutate(() => void db.addGoal(g)),
      removeGoal: (id) => mutate(() => db.removeGoal(id)),
      addPlan: (p) => mutate(() => void db.addPlan(p)),
      updatePlan: (id, p) => mutate(() => db.updatePlan(id, p)),
      removePlan: (id) => mutate(() => db.removePlan(id)),
      updateSettings: (s) => mutate(() => db.updateSettings(s)),
      importData: (d, m) => mutate(() => db.importData(d, m)),
      clear: () => mutate(() => db.clear()),
    }),
    [data, activities, db, mutate],
  );
}
