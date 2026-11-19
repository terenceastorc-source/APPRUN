import { describe, expect, it } from 'vitest';
import { makeActivity } from '../test/factories';
import {
  benchmarkHistory,
  benchmarkNames,
  liftHistory,
  liftNames,
  maxHeartRate,
  monthlyRunning,
  raceHistory,
  racePredictions,
  riegel,
  stationStats,
  timeInZones,
  zoneOf,
} from './analytics';

const TODAY = new Date(2026, 10, 19);

describe('prédictions de course', () => {
  it('formule de Riegel', () => {
    // 10 km en 50:00 → semi ≈ 1:50:20
    expect(riegel(10000, 3000, 21097)).toBeCloseTo(6620, -1);
    expect(riegel(5000, 1500, 5000)).toBe(1500);
  });

  it('retient la meilleure performance récente et ignore les sorties trop courtes ou anciennes', () => {
    const tenK = makeActivity({ date: '2026-11-01', distanceMeters: 10000, durationSeconds: 3000 });
    const slow = makeActivity({ date: '2026-11-10', distanceMeters: 10000, durationSeconds: 3600 });
    const old = makeActivity({ date: '2026-01-01', distanceMeters: 10000, durationSeconds: 2400 });
    const bike = makeActivity({ date: '2026-11-02', sport: 'velo', distanceMeters: 40000, durationSeconds: 3600 });
    const p = racePredictions([tenK, slow, old, bike], TODAY);
    expect(p.map((x) => x.label)).toEqual(['5 km', '10 km', 'Semi-marathon', 'Marathon']);
    expect(p[1]!.seconds).toBe(3000);
    expect(p.every((x) => x.basedOn === tenK)).toBe(true);
    // Un 3 km ne suffit pas pour prédire un marathon (facteur > 8).
    expect(racePredictions([makeActivity({ date: '2026-11-01', distanceMeters: 3000, durationSeconds: 780 })], TODAY).map((x) => x.label)).toEqual(['5 km', '10 km', 'Semi-marathon']);
  });

  it('volume et allure par mois', () => {
    const m = monthlyRunning([makeActivity({ date: '2026-11-03', distanceMeters: 10000, durationSeconds: 3000 }), makeActivity({ date: '2026-11-05', distanceMeters: 5000, durationSeconds: 1800 })], 2, TODAY);
    expect(m).toEqual([
      { month: '2026-10', distanceMeters: 0, pace: null, count: 0 },
      { month: '2026-11', distanceMeters: 15000, pace: 320, count: 2 },
    ]);
  });
});

describe('fréquence cardiaque', () => {
  it('FC max du profil ou estimée', () => {
    expect(maxHeartRate({ maxHr: 190 }, [])).toEqual({ bpm: 190, estimated: false });
    expect(maxHeartRate({}, [makeActivity({ heartRateMax: 186 }), makeActivity({ heartRateMax: 179 })])).toEqual({ bpm: 186, estimated: true });
    expect(maxHeartRate({}, [])).toBeNull();
  });

  it('zones en % de FC max', () => {
    expect(zoneOf(100, 200).id).toBe(1);
    expect(zoneOf(130, 200).id).toBe(2);
    expect(zoneOf(140, 200).id).toBe(3); // 70 % pile : début de Z3
    expect(zoneOf(150, 200).id).toBe(3);
    expect(zoneOf(170, 200).id).toBe(4);
    expect(zoneOf(195, 200).id).toBe(5);
  });

  it('temps par zone sur la période', () => {
    const z = timeInZones([makeActivity({ date: '2026-11-18', heartRateAvg: 135, durationSeconds: 3600 }), makeActivity({ date: '2026-11-17', heartRateAvg: 172, durationSeconds: 1800 }), makeActivity({ date: '2026-01-01', heartRateAvg: 140 }), makeActivity({ date: '2026-11-18' })], 200, TODAY);
    expect(z.map((x) => x.seconds)).toEqual([0, 3600, 0, 1800, 0]);
  });
});

describe('CrossFit', () => {
  const wod = (date: string, wodName: string, score: string, format: 'for-time' | 'amrap' = 'for-time', level: 'rx' | 'scaled' = 'rx') =>
    makeActivity({ date, sport: 'crossfit', distanceMeters: undefined, crossfit: { wodName, score, format, level } });

  it('historique d’un benchmark en ordre chronologique', () => {
    const list = [wod('2026-11-10', 'Fran', '4:10'), wod('2026-09-01', 'fran', '5:02', 'for-time', 'scaled'), wod('2026-10-01', 'Cindy', '18+2', 'amrap')];
    expect(benchmarkNames(list)).toEqual(['Fran', 'Cindy']);
    expect(benchmarkHistory(list, 'FRAN')).toEqual({
      lowerIsBetter: true,
      points: [
        { date: '2026-09-01', value: 302, score: '5:02', rx: false },
        { date: '2026-11-10', value: 250, score: '4:10', rx: true },
      ],
    });
  });

  it('1RM estimé par séance', () => {
    const s = (date: string, lifts: { exercise: string; sets: number; reps: number; weightKg?: number }[]) =>
      makeActivity({ date, sport: 'crossfit', crossfit: { format: 'force', level: 'rx', lifts } });
    const list = [s('2026-11-10', [{ exercise: 'Back Squat', sets: 5, reps: 3, weightKg: 110 }, { exercise: 'back squat', sets: 1, reps: 1, weightKg: 120 }]), s('2026-10-01', [{ exercise: 'Back Squat', sets: 5, reps: 5, weightKg: 100 }])];
    expect(liftNames(list)).toEqual(['Back Squat']);
    expect(liftHistory(list, 'Back Squat')).toEqual([
      { date: '2026-10-01', oneRm: 116.7, weightKg: 100, reps: 5 },
      { date: '2026-11-10', oneRm: 121, weightKg: 110, reps: 3 },
    ]);
  });
});

describe('HYROX', () => {
  const race = (date: string, ski: number, sled: number, official = false) =>
    makeActivity({ date, sport: 'hyrox', distanceMeters: undefined, durationSeconds: 4000 + ski, race: { official, segments: [{ name: 'SkiErg 1000 m', kind: 'station', seconds: ski }, { name: 'Sled Push 50 m', kind: 'station', seconds: sled }, { name: 'Wall Balls', kind: 'station' }] } });

  it('historique et statistiques par atelier', () => {
    const list = [race('2026-11-01', 250, 200, true), race('2026-10-01', 260, 180)];
    expect(raceHistory(list, 'hyrox').map((r) => r.date)).toEqual(['2026-10-01', '2026-11-01']);
    expect(stationStats(list, 'hyrox')).toEqual([
      { name: 'SkiErg 1000 m', kind: 'station', last: 250, best: 250, average: 255, count: 2, gap: 0 },
      { name: 'Sled Push 50 m', kind: 'station', last: 200, best: 180, average: 190, count: 2, gap: 20 },
    ]);
  });
});
