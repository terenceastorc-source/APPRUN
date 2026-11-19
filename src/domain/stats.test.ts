import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/factories';
import { distanceRecords, highlights, periodSummary, sortByDateDesc, startOfWeek, totals, weekStreak, weeklyDistance } from './stats';
import { toIsoDate } from './format';

// Jeudi 19 novembre 2026
const TODAY = new Date(2026, 10, 19);

describe('totals', () => {
  it('somme distances et durées et pondère l\'allure par la distance', () => {
    const t = totals([makeRun({ distanceMeters: 5000, durationSeconds: 1500 }), makeRun({ distanceMeters: 15000, durationSeconds: 5400 })]);
    expect(t.count).toBe(2);
    expect(t.distanceMeters).toBe(20000);
    expect(t.avgPace).toBe(345);
  });
  it('gère une liste vide', () => {
    expect(totals([])).toEqual({ count: 0, distanceMeters: 0, durationSeconds: 0, avgPace: 0 });
  });
});

describe('startOfWeek', () => {
  it('retourne le lundi, y compris pour un dimanche', () => {
    expect(toIsoDate(startOfWeek(TODAY))).toBe('2026-11-16');
    expect(toIsoDate(startOfWeek(new Date(2026, 10, 22)))).toBe('2026-11-16');
    expect(toIsoDate(startOfWeek(new Date(2026, 10, 16)))).toBe('2026-11-16');
  });
});

describe('weeklyDistance', () => {
  it('produit N semaines contiguës, vides incluses', () => {
    const runs = [makeRun({ date: '2026-11-17', distanceMeters: 8000 }), makeRun({ date: '2026-11-19', distanceMeters: 4000 }), makeRun({ date: '2026-11-03', distanceMeters: 10000 })];
    const weeks = weeklyDistance(runs, 4, TODAY);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
    expect(weeks.map((w) => w.distanceMeters)).toEqual([0, 10000, 0, 12000]);
    expect(weeks[3]!.count).toBe(2);
  });
});

describe('periodSummary', () => {
  it('répartit les courses par semaine, mois et année', () => {
    const runs = [
      makeRun({ date: '2026-11-18', distanceMeters: 5000 }),
      makeRun({ date: '2026-11-02', distanceMeters: 7000 }),
      makeRun({ date: '2026-02-10', distanceMeters: 9000 }),
      makeRun({ date: '2025-12-31', distanceMeters: 11000 }),
    ];
    const s = periodSummary(runs, TODAY);
    expect(s.week.distanceMeters).toBe(5000);
    expect(s.month.distanceMeters).toBe(12000);
    expect(s.year.distanceMeters).toBe(21000);
    expect(s.all.distanceMeters).toBe(32000);
  });
});

describe('distanceRecords', () => {
  it('garde le meilleur temps par distance, avec une tolérance GPS', () => {
    const fast = makeRun({ distanceMeters: 5050, durationSeconds: 1290 });
    const runs = [makeRun({ distanceMeters: 5000, durationSeconds: 1400 }), fast, makeRun({ distanceMeters: 5300, durationSeconds: 1000 }), makeRun({ distanceMeters: 10000, durationSeconds: 3000 })];
    const records = distanceRecords(runs);
    expect(records.map((r) => r.label)).toEqual(['5 km', '10 km']);
    expect(records[0]!.run).toBe(fast);
  });
});

describe('highlights', () => {
  it('ignore les sorties < 1 km pour la meilleure allure', () => {
    const sprint = makeRun({ distanceMeters: 400, durationSeconds: 60 });
    const tempo = makeRun({ distanceMeters: 8000, durationSeconds: 2000 });
    const long = makeRun({ distanceMeters: 25000, durationSeconds: 9000 });
    const h = highlights([sprint, tempo, long]);
    expect(h.fastest).toBe(tempo);
    expect(h.longest).toBe(long);
    expect(h.longestDuration).toBe(long);
  });
  it('retourne des valeurs vides sans course', () => {
    expect(highlights([])).toEqual({ longest: undefined, fastest: undefined, longestDuration: undefined });
  });
});

describe('weekStreak', () => {
  it('compte les semaines consécutives', () => {
    const runs = ['2026-11-17', '2026-11-12', '2026-11-03', '2026-10-20'].map((date) => makeRun({ date }));
    expect(weekStreak(runs, TODAY)).toBe(3);
  });
  it('ne casse pas la série si la semaine en cours est vide', () => {
    const runs = ['2026-11-12', '2026-11-03'].map((date) => makeRun({ date }));
    expect(weekStreak(runs, TODAY)).toBe(2);
  });
  it('vaut 0 sans course récente', () => {
    expect(weekStreak([makeRun({ date: '2026-01-01' })], TODAY)).toBe(0);
  });
});

describe('sortByDateDesc', () => {
  it('trie par date puis création décroissantes sans modifier l\'entrée', () => {
    const a = makeRun({ date: '2026-11-01', createdAt: '2026-11-01T07:00:00Z' });
    const b = makeRun({ date: '2026-11-01', createdAt: '2026-11-01T18:00:00Z' });
    const c = makeRun({ date: '2026-11-10' });
    const input = [a, b, c];
    expect(sortByDateDesc(input)).toEqual([c, b, a]);
    expect(input).toEqual([a, b, c]);
  });
});
