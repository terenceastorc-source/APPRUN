import { describe, expect, it } from 'vitest';
import type { ActivityInput } from './types';
import { validateActivity, validateBody, validatePlan } from './validation';

const TODAY = '2026-11-19';
const run: ActivityInput = { sport: 'course', date: '2026-11-18', durationSeconds: 3000, distanceMeters: 10000, source: 'manual' };

describe('validateActivity', () => {
  it('accepte une course et un WOD valides', () => {
    expect(validateActivity(run, TODAY)).toEqual({});
    expect(validateActivity({ sport: 'crossfit', date: TODAY, durationSeconds: 1200, rpe: 9, source: 'manual', crossfit: { format: 'for-time', level: 'rx', score: '4:30' } }, TODAY)).toEqual({});
  });

  it('exige une distance pour l’endurance seulement', () => {
    expect(validateActivity({ ...run, distanceMeters: undefined }, TODAY).distanceMeters).toBeDefined();
    expect(validateActivity({ ...run, sport: 'hyrox', distanceMeters: undefined }, TODAY)).toEqual({});
  });

  it('refuse date future, durée nulle, RPE et FC incohérents, NaN', () => {
    const e = validateActivity({ ...run, date: '2026-11-20', durationSeconds: 0, rpe: 11, heartRateAvg: 170, heartRateMax: 160, elevationGain: Number.NaN }, TODAY);
    expect(Object.keys(e).sort()).toEqual(['date', 'durationSeconds', 'elevationGain', 'heartRateMax', 'rpe']);
  });

  it('valide exercices et segments', () => {
    const e = validateActivity(
      { ...run, sport: 'crossfit', distanceMeters: undefined, crossfit: { format: 'force', level: 'rx', lifts: [{ exercise: '', sets: 5, reps: 5 }, { exercise: 'Squat', sets: 0, reps: 5 }] } },
      TODAY,
    );
    expect(e['lift-0']).toBeDefined();
    expect(e['lift-1']).toBeDefined();
    const r = validateActivity({ ...run, sport: 'hyrox', distanceMeters: undefined, race: { official: true, segments: [{ name: ' ', kind: 'run' }] } }, TODAY);
    expect(r['segment-0']).toBeDefined();
  });
});

describe('validateBody', () => {
  it('exige au moins une mesure et des valeurs plausibles', () => {
    expect(validateBody({ date: TODAY, weightKg: 72.5 }, TODAY)).toEqual({});
    expect(validateBody({ date: TODAY }, TODAY).weightKg).toBeDefined();
    expect(Object.keys(validateBody({ date: TODAY, weightKg: 500, sleepHours: 30, form: 0 }, TODAY)).sort()).toEqual(['form', 'sleepHours', 'weightKg']);
  });
});

describe('validatePlan', () => {
  it('exige un titre', () => {
    expect(validatePlan({ date: TODAY, sport: 'course', title: '  ' }).title).toBeDefined();
    expect(validatePlan({ date: '2026-12-01', sport: 'hyrox', title: 'Simulation' })).toEqual({});
  });
});
