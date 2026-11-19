import { describe, expect, it } from 'vitest';
import { makeActivity } from '../test/factories';
import { goalProgress, metricValue, scopeLabel } from './goals';

const TODAY = new Date(2026, 10, 19); // jeudi

describe('metricValue', () => {
  const list = [makeActivity({ distanceMeters: 5000, durationSeconds: 1800, rpe: 5 }), makeActivity({ sport: 'crossfit', distanceMeters: undefined, durationSeconds: 3600, rpe: 8 })];
  it('convertit dans l’unité de l’objectif', () => {
    expect(metricValue(list, 'distance')).toBe(5);
    expect(metricValue(list, 'duration')).toBe(1.5);
    expect(metricValue(list, 'sessions')).toBe(2);
    expect(metricValue(list, 'load')).toBe(150 + 480);
  });
});

describe('goalProgress', () => {
  it('filtre par portée et période et calcule le temps écoulé', () => {
    const list = [
      makeActivity({ date: '2026-11-17', distanceMeters: 8000 }),
      makeActivity({ date: '2026-11-18', sport: 'velo', distanceMeters: 40000 }),
      makeActivity({ date: '2026-11-10', distanceMeters: 12000 }),
    ];
    const p = goalProgress({ id: 'g', scope: 'course', metric: 'distance', period: 'week', target: 20 }, list, TODAY);
    expect(p.done).toBe(8);
    expect(p.ratio).toBe(0.4);
    expect(p.elapsed).toBeCloseTo(4 / 7);
  });
});

describe('scopeLabel', () => {
  it('libellés lisibles', () => {
    expect(scopeLabel('all')).toBe('Toutes activités');
    expect(scopeLabel('race')).toBe('HYROX / ATH X');
    expect(scopeLabel('velo')).toBe('Vélo');
  });
});
