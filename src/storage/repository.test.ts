import { describe, expect, it } from 'vitest';
import { makeRun, memoryStore } from '../test/factories';
import { RunRepository } from './repository';

const input = { date: '2026-11-18', distanceMeters: 10000, durationSeconds: 3000, type: 'footing' as const };

function repo(store = memoryStore()) {
  let n = 0;
  return { store, repo: new RunRepository(store, () => new Date('2026-11-19T10:00:00Z'), () => `id-${++n}`) };
}

describe('RunRepository', () => {
  it('ajoute, persiste et relit les courses', () => {
    const { store, repo: r } = repo();
    const run = r.add({ ...input, notes: '  belle sortie  ' });
    expect(run).toMatchObject({ id: 'id-1', notes: 'belle sortie', createdAt: '2026-11-19T10:00:00.000Z' });
    const reloaded = new RunRepository(store);
    expect(reloaded.getRuns()).toEqual([run]);
  });

  it('ne stocke pas les champs optionnels vides', () => {
    const { repo: r } = repo();
    const run = r.add({ ...input, notes: '   ', effort: undefined });
    expect(Object.keys(run)).not.toContain('notes');
    expect(Object.keys(run)).not.toContain('effort');
  });

  it('met à jour en conservant la date de création', () => {
    const { repo: r } = repo();
    const run = r.add(input);
    const updated = r.update(run.id, { ...input, distanceMeters: 12000 });
    expect(updated.distanceMeters).toBe(12000);
    expect(updated.createdAt).toBe(run.createdAt);
    expect(r.getRuns()).toHaveLength(1);
    expect(() => r.update('inconnu', input)).toThrow();
  });

  it('supprime une course', () => {
    const { repo: r } = repo();
    const a = r.add(input);
    r.add(input);
    r.remove(a.id);
    expect(r.getRuns().map((x) => x.id)).toEqual(['id-2']);
  });

  it('importe en fusionnant par identifiant', () => {
    const { repo: r } = repo();
    const existing = r.add(input);
    const count = r.importRuns([{ ...existing, distanceMeters: 21097 }, makeRun({ id: 'new' })]);
    expect(count).toBe(2);
    expect(r.getRuns()).toHaveLength(2);
    expect(r.getRuns().find((x) => x.id === existing.id)?.distanceMeters).toBe(21097);
  });

  it('persiste les réglages et fournit des valeurs par défaut', () => {
    const { store, repo: r } = repo();
    expect(r.getSettings().weeklyGoalKm).toBe(20);
    r.updateSettings({ weeklyGoalKm: 35 });
    expect(new RunRepository(store).getSettings().weeklyGoalKm).toBe(35);
  });

  it('résiste à des données corrompues ou partiellement invalides', () => {
    expect(new RunRepository(memoryStore({ 'apprun:data': '{pas du json' })).getRuns()).toEqual([]);
    const mixed = JSON.stringify({ version: 1, runs: [makeRun({ id: 'ok' }), { id: 'ko', date: 'hier' }, null] });
    expect(new RunRepository(memoryStore({ 'apprun:data': mixed })).getRuns().map((x) => x.id)).toEqual(['ok']);
  });

  it('efface toutes les données', () => {
    const { repo: r } = repo();
    r.add(input);
    r.updateSettings({ weeklyGoalKm: 50 });
    r.clear();
    expect(r.getRuns()).toEqual([]);
    expect(r.getSettings().weeklyGoalKm).toBe(20);
  });
});
