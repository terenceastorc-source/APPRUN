import { describe, expect, it } from 'vitest';
import { makeActivity } from '../test/factories';
import { hyroxTemplate, segmentBreakdown, segmentsTotal } from './hyrox';
import { benchmarkRecords, bestSegments, enduranceHighlights, estimateOneRepMax, liftRecords, raceRecords, runRecords, scoreValue } from './records';

describe('runRecords', () => {
  it('meilleur temps par distance avec tolérance GPS, course uniquement', () => {
    const fast = makeActivity({ distanceMeters: 5050, durationSeconds: 1290 });
    const list = [makeActivity({ distanceMeters: 5000, durationSeconds: 1400 }), fast, makeActivity({ distanceMeters: 5300, durationSeconds: 1000 }), makeActivity({ sport: 'velo', distanceMeters: 5000, durationSeconds: 600 })];
    const r = runRecords(list);
    expect(r.map((x) => x.label)).toEqual(['5 km']);
    expect(r[0]!.activity).toBe(fast);
  });
});

describe('HYROX', () => {
  it('modèle standard : 8 courses + 8 ateliers + roxzone', () => {
    const t = hyroxTemplate();
    expect(t).toHaveLength(17);
    expect(t.filter((s) => s.kind === 'run')).toHaveLength(8);
    expect(t[1]!.name).toBe('SkiErg 1000 m');
    expect(t[15]!.name).toBe('Wall Balls');
  });

  it('totaux et répartition', () => {
    const segs = [
      { name: 'Course 1', kind: 'run' as const, seconds: 300 },
      { name: 'SkiErg', kind: 'station' as const, seconds: 240 },
      { name: 'Roxzone', kind: 'roxzone' as const, seconds: 60 },
      { name: 'Wall Balls', kind: 'station' as const },
    ];
    expect(segmentsTotal(segs)).toBe(600);
    expect(segmentBreakdown(segs)).toEqual({ run: 300, station: 240, roxzone: 60, other: 0 });
  });

  it('records course officielle vs entraînement, et meilleurs segments', () => {
    const race = (official: boolean, durationSeconds: number, ski: number) =>
      makeActivity({ sport: 'hyrox', distanceMeters: undefined, durationSeconds, race: { official, segments: [{ name: 'SkiErg 1000 m', kind: 'station', seconds: ski }] } });
    const list = [race(true, 5400, 260), race(true, 5100, 250), race(false, 4000, 240)];
    expect(raceRecords(list).map((r) => [r.label, r.seconds])).toEqual([
      ['HYROX (course)', 5100],
      ['HYROX (entraînement)', 4000],
    ]);
    expect(bestSegments(list).get('SkiErg 1000 m')).toBe(240);
  });
});

describe('CrossFit', () => {
  it('interprète les scores selon le format', () => {
    expect(scoreValue('for-time', '4:32')).toEqual({ value: 272, lowerIsBetter: true });
    expect(scoreValue('amrap', '5+12')).toEqual({ value: 5012, lowerIsBetter: false });
    expect(scoreValue('amrap', '7 rounds')).toEqual({ value: 7000, lowerIsBetter: false });
    expect(scoreValue('force', '102,5 kg')).toEqual({ value: 102.5, lowerIsBetter: false });
    expect(scoreValue('emom', 'ok')).toBeNull();
    expect(scoreValue('for-time', undefined)).toBeNull();
  });

  it('meilleur score par benchmark, RX prioritaire', () => {
    const wod = (wodName: string, score: string, level: 'rx' | 'scaled', format: 'for-time' | 'amrap' = 'for-time') =>
      makeActivity({ sport: 'crossfit', distanceMeters: undefined, crossfit: { wodName, score, level, format } });
    const list = [wod('Fran', '3:58', 'scaled'), wod('Fran', '5:10', 'rx'), wod('fran', '4:45', 'rx'), wod('Cindy', '18+3', 'rx', 'amrap'), wod('Cindy', '20', 'rx', 'amrap')];
    expect(benchmarkRecords(list).map((r) => [r.wodName, r.score, r.attempts])).toEqual([
      ['Cindy', '20', 2],
      ['fran', '4:45', 3],
    ]);
  });

  it('charge max par exercice et 1RM estimé', () => {
    const list = [
      makeActivity({ sport: 'crossfit', crossfit: { format: 'force', level: 'rx', lifts: [{ exercise: 'Back Squat', sets: 5, reps: 5, weightKg: 100 }] } }),
      makeActivity({ sport: 'crossfit', date: '2026-11-18', crossfit: { format: 'force', level: 'rx', lifts: [{ exercise: 'back squat ', sets: 3, reps: 3, weightKg: 110 }, { exercise: 'Strict Press', sets: 5, reps: 5 }] } }),
    ];
    expect(liftRecords(list)).toEqual([{ exercise: 'back squat', weightKg: 110, reps: 3, date: '2026-11-18' }]);
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1);
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });
});

describe('enduranceHighlights', () => {
  it('plus longue et plus rapide (≥ 1 km)', () => {
    const sprint = makeActivity({ distanceMeters: 400, durationSeconds: 60 });
    const tempo = makeActivity({ distanceMeters: 8000, durationSeconds: 2000 });
    const long = makeActivity({ distanceMeters: 25000, durationSeconds: 9000 });
    expect(enduranceHighlights([sprint, tempo, long])).toEqual({ longest: long, fastest: tempo });
  });
});
