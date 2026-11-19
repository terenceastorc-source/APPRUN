import { describe, expect, it } from 'vitest';
import { makeActivity } from '../test/factories';
import { bySport, inPeriod, matchesScope, sortByDateDesc, totals, weekStreak, weeklyByCategory } from './stats';

const TODAY = new Date(2026, 10, 19); // jeudi 19 novembre 2026

describe('totals', () => {
  it('additionne durée, distance et charge', () => {
    const t = totals([makeActivity({ durationSeconds: 3600, rpe: 5 }), makeActivity({ sport: 'crossfit', distanceMeters: undefined, durationSeconds: 1800, rpe: 8 })]);
    expect(t).toEqual({ count: 2, durationSeconds: 5400, distanceMeters: 10000, load: 300 + 240 });
  });
});

describe('matchesScope', () => {
  const run = makeActivity({ sport: 'course' });
  const wod = makeActivity({ sport: 'crossfit' });
  it('gère toutes activités, catégories et sports', () => {
    expect(matchesScope(wod, 'all')).toBe(true);
    expect(matchesScope(run, 'endurance')).toBe(true);
    expect(matchesScope(wod, 'endurance')).toBe(false);
    expect(matchesScope(run, 'course')).toBe(true);
    expect(matchesScope(run, 'trail')).toBe(false);
    expect(matchesScope(makeActivity({ sport: 'hyrox' }), 'race')).toBe(true);
  });
});

describe('inPeriod', () => {
  const list = ['2026-11-15', '2026-11-16', '2026-11-30', '2026-12-01', '2026-01-01', '2025-12-31'].map((date) => makeActivity({ date }));
  it('semaine (lundi→dimanche), mois et année', () => {
    expect(inPeriod(list, 'week', TODAY).map((a) => a.date)).toEqual(['2026-11-16']);
    expect(inPeriod(list, 'month', TODAY)).toHaveLength(3);
    expect(inPeriod(list, 'year', TODAY)).toHaveLength(5);
  });
});

describe('weeklyByCategory', () => {
  it('répartit le temps par catégorie, semaines vides incluses', () => {
    const list = [
      makeActivity({ date: '2026-11-17', durationSeconds: 3600 }),
      makeActivity({ date: '2026-11-18', sport: 'crossfit', durationSeconds: 1200 }),
      makeActivity({ date: '2026-11-03', sport: 'hyrox', durationSeconds: 5000 }),
    ];
    const weeks = weeklyByCategory(list, 3, TODAY);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(weeks[0]!.seconds).toEqual({ endurance: 0, crossfit: 0, race: 5000 });
    expect(weeks[1]!.count).toBe(0);
    expect(weeks[2]!.seconds).toEqual({ endurance: 3600, crossfit: 1200, race: 0 });
  });
});

describe('bySport', () => {
  it('trie par temps décroissant', () => {
    const res = bySport([makeActivity({ durationSeconds: 100 }), makeActivity({ sport: 'velo', durationSeconds: 5000 }), makeActivity({ durationSeconds: 200 })]);
    expect(res.map((r) => [r.sport, r.count, r.durationSeconds])).toEqual([
      ['velo', 1, 5000],
      ['course', 2, 300],
    ]);
  });
});

describe('weekStreak', () => {
  it('compte les semaines consécutives, la semaine courante vide ne casse pas la série', () => {
    expect(weekStreak(['2026-11-17', '2026-11-12', '2026-11-03', '2026-10-20'].map((date) => makeActivity({ date })), TODAY)).toBe(3);
    expect(weekStreak(['2026-11-12', '2026-11-03'].map((date) => makeActivity({ date })), TODAY)).toBe(2);
    expect(weekStreak([], TODAY)).toBe(0);
  });
});

describe('sortByDateDesc', () => {
  it("trie par date, heure puis création sans modifier l'entrée", () => {
    const a = makeActivity({ date: '2026-11-01', startTime: '07:00' });
    const b = makeActivity({ date: '2026-11-01', startTime: '18:00' });
    const c = makeActivity({ date: '2026-11-10' });
    const input = [a, b, c];
    expect(sortByDateDesc(input)).toEqual([c, b, a]);
    expect(input).toEqual([a, b, c]);
  });
});
