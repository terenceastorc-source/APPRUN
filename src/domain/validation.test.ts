import { describe, expect, it } from 'vitest';
import type { RunInput } from './types';
import { validateRun } from './validation';

const valid: RunInput = { date: '2026-11-18', distanceMeters: 10000, durationSeconds: 3000, type: 'footing' };
const TODAY = '2026-11-19';

describe('validateRun', () => {
  it('accepte une course valide', () => {
    expect(validateRun(valid, TODAY)).toEqual({});
    expect(validateRun({ ...valid, effort: 3, heartRateAvg: 150, elevationGain: 120 }, TODAY)).toEqual({});
  });

  it('refuse une date future ou mal formée', () => {
    expect(validateRun({ ...valid, date: '2026-11-20' }, TODAY).date).toBeDefined();
    expect(validateRun({ ...valid, date: '18/11/2026' }, TODAY).date).toBeDefined();
  });

  it('refuse distance et durée invalides', () => {
    const e = validateRun({ ...valid, distanceMeters: Number.NaN, durationSeconds: 0 }, TODAY);
    expect(e.distanceMeters).toBeDefined();
    expect(e.durationSeconds).toBeDefined();
  });

  it('contrôle les champs optionnels', () => {
    const e = validateRun({ ...valid, effort: 6, heartRateAvg: 400, elevationGain: -5 }, TODAY);
    expect(Object.keys(e).sort()).toEqual(['effort', 'elevationGain', 'heartRateAvg']);
    expect(validateRun({ ...valid, heartRateAvg: Number.NaN }, TODAY).heartRateAvg).toBeDefined();
  });
});
