import { describe, expect, it } from 'vitest';
import { makeActivity, memoryStore } from '../test/factories';
import type { ActivityInput } from '../domain/types';
import { Database, STORAGE_KEY, migrate } from './database';

const input: ActivityInput = { sport: 'course', date: '2026-11-18', durationSeconds: 3000, distanceMeters: 10000, source: 'manual' };

function db(store = memoryStore()) {
  let n = 0;
  return { store, db: new Database(store, () => new Date('2026-11-19T10:00:00Z'), () => `id-${++n}`) };
}

describe('Database — activités', () => {
  it('ajoute, nettoie, persiste et relit', () => {
    const { store, db: d } = db();
    const a = d.addActivity({ ...input, notes: '  belle sortie ', title: ' ', rpe: undefined });
    expect(a).toMatchObject({ id: 'id-1', notes: 'belle sortie', createdAt: '2026-11-19T10:00:00.000Z' });
    expect('title' in a).toBe(false);
    expect('rpe' in a).toBe(false);
    expect(new Database(store).snapshot().activities).toEqual([a]);
  });

  it('met à jour en conservant la création', () => {
    const { db: d } = db();
    const a = d.addActivity(input);
    const u = d.updateActivity(a.id, { ...input, distanceMeters: 12000 });
    expect(u).toMatchObject({ distanceMeters: 12000, createdAt: a.createdAt });
    expect(() => d.updateActivity('x', input)).toThrow();
  });

  it('lie une activité à sa séance planifiée et la délie à la suppression', () => {
    const { db: d } = db();
    const plan = d.addPlan({ date: '2026-11-18', sport: 'course', title: 'Footing' });
    const a = d.addActivity({ ...input, planId: plan.id });
    expect(d.snapshot().plans[0]!.activityId).toBe(a.id);
    d.removeActivity(a.id);
    expect(d.snapshot().plans[0]!.activityId).toBeUndefined();
  });

  it('supprimer une séance planifiée délie l’activité', () => {
    const { db: d } = db();
    const plan = d.addPlan({ date: '2026-11-18', sport: 'course', title: 'Footing' });
    d.addActivity({ ...input, planId: plan.id });
    d.removePlan(plan.id);
    expect(d.snapshot().activities[0]!.planId).toBeUndefined();
  });
});

describe('Database — corps, objectifs, réglages', () => {
  it('une entrée corps par date, triée', () => {
    const { db: d } = db();
    d.upsertBody({ date: '2026-11-18', weightKg: 72 });
    d.upsertBody({ date: '2026-11-10', weightKg: 73 });
    d.upsertBody({ date: '2026-11-18', weightKg: 71.5, sleepHours: 7 });
    expect(d.snapshot().body).toEqual([
      { date: '2026-11-10', weightKg: 73 },
      { date: '2026-11-18', weightKg: 71.5, sleepHours: 7 },
    ]);
    d.removeBody('2026-11-10');
    expect(d.snapshot().body).toHaveLength(1);
  });

  it('objectifs et réglages', () => {
    const { store, db: d } = db();
    const g = d.addGoal({ scope: 'all', metric: 'sessions', period: 'week', target: 4 });
    d.updateSettings({ maxHr: 190 });
    const re = new Database(store).snapshot();
    expect(re.goals).toEqual([g]);
    expect(re.settings.maxHr).toBe(190);
    d.removeGoal(g.id);
    expect(d.snapshot().goals).toEqual([]);
  });
});

describe('Database — import', () => {
  it('fusionne par identifiant ou remplace', () => {
    const { db: d } = db();
    const a = d.addActivity(input);
    const incoming = { ...d.snapshot(), activities: [{ ...a, distanceMeters: 21097 }, makeActivity({ id: 'new' })] };
    d.importData(incoming, 'merge');
    expect(d.snapshot().activities).toHaveLength(2);
    expect(d.snapshot().activities.find((x) => x.id === a.id)!.distanceMeters).toBe(21097);
    d.importData({ ...incoming, activities: [] }, 'replace');
    expect(d.snapshot().activities).toEqual([]);
  });
});

describe('migration', () => {
  it('convertit les données de la v1 (application course)', () => {
    const v1 = {
      version: 1,
      runs: [
        { id: 'r1', date: '2026-11-01', distanceMeters: 10000, durationSeconds: 3000, type: 'fractionne', effort: 4, notes: 'piste', createdAt: 'c', updatedAt: 'u' },
        { id: 'r2', date: '2026-11-02', distanceMeters: 15000, durationSeconds: 6000, type: 'trail', createdAt: 'c', updatedAt: 'u' },
        { id: 'bad', date: '2026-11-03', distanceMeters: 0, durationSeconds: 10, type: 'footing' },
      ],
      settings: { weeklyGoalKm: 25 },
    };
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify(v1) });
    const data = new Database(store).snapshot();
    expect(data.version).toBe(2);
    expect(data.activities).toEqual([
      { id: 'r1', sport: 'course', runType: 'fractionne', date: '2026-11-01', distanceMeters: 10000, durationSeconds: 3000, rpe: 8, notes: 'piste', source: 'manual', createdAt: 'c', updatedAt: 'u' },
      { id: 'r2', sport: 'trail', date: '2026-11-02', distanceMeters: 15000, durationSeconds: 6000, source: 'manual', createdAt: 'c', updatedAt: 'u' },
    ]);
    expect(data.goals).toEqual([{ id: 'migrated-weekly-km', scope: 'course', metric: 'distance', period: 'week', target: 25 }]);
  });

  it('résiste aux données corrompues ou partiellement invalides', () => {
    expect(new Database(memoryStore({ [STORAGE_KEY]: '{pas du json' })).snapshot().activities).toEqual([]);
    expect(migrate(null).activities).toEqual([]);
    const v2 = { version: 2, activities: [makeActivity({ id: 'ok' }), { id: 'ko', sport: 'golf' }], body: 'x', goals: null, plans: [] };
    expect(migrate(v2).activities.map((a) => a.id)).toEqual(['ok']);
    expect(migrate(v2).body).toEqual([]);
  });
});
