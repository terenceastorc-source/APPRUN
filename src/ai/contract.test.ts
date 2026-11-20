import { describe, expect, it } from 'vitest';
import { SPORT_IDS } from '../domain/sports';
import { WOD_FORMATS } from '../domain/types';
import { SPORT_VALUES, WOD_FORMAT_VALUES, isCoachAdvice, isWodExtraction } from './contract';

describe('contrat IA', () => {
  it('reste aligné sur le modèle de l’app', () => {
    expect([...SPORT_VALUES]).toEqual([...SPORT_IDS]);
    expect([...WOD_FORMAT_VALUES]).toEqual([...WOD_FORMATS]);
  });

  it('gardes de forme', () => {
    expect(isWodExtraction({ readable: true, title: 'x', format: 'amrap', workout: '', lifts: [] })).toBe(true);
    expect(isWodExtraction({ readable: true, title: 'x', format: 'zumba', workout: '', lifts: [] })).toBe(false);
    expect(isCoachAdvice({ status: 'go', headline: 'x', session: { sport: 'course' }, tips: [] })).toBe(true);
    expect(isCoachAdvice({ status: 'go', headline: 'x', session: { sport: 'golf' }, tips: [] })).toBe(false);
    expect(isCoachAdvice(null)).toBe(false);
  });
});
