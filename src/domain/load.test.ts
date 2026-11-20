import { describe, expect, it } from 'vitest';
import { makeActivity } from '../test/factories';
import { activityLoad, dailyLoads, loadHistory, loadState } from './load';

const TODAY = new Date(2026, 10, 19);

describe('activityLoad', () => {
  it('durée (min) × RPE, 0 sans RPE', () => {
    expect(activityLoad({ durationSeconds: 3600, rpe: 6 })).toBe(360);
    expect(activityLoad({ durationSeconds: 3600 })).toBe(0);
  });
});

describe('dailyLoads', () => {
  it('cumule les séances du même jour et remplit les jours vides', () => {
    const list = [makeActivity({ date: '2026-11-19', durationSeconds: 600, rpe: 5 }), makeActivity({ date: '2026-11-19', durationSeconds: 1200, rpe: 5 })];
    expect(dailyLoads(list, 3, TODAY)).toEqual([
      { date: '2026-11-17', load: 0 },
      { date: '2026-11-18', load: 0 },
      { date: '2026-11-19', load: 150 },
    ]);
  });
});

describe('loadState', () => {
  /** Une séance de charge `load` chaque jour sur `days` jours se terminant `offset` jours avant TODAY. */
  function daily(load: number, days: number, offset = 0) {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(TODAY);
      d.setDate(d.getDate() - offset - i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return makeActivity({ date, durationSeconds: load * 60, rpe: 1 });
    });
  }

  it('sans historique', () => {
    expect(loadState([], TODAY)).toMatchObject({ acute: 0, ratio: null, status: 'insuffisant' });
  });

  it('charge régulière → ratio 1, zone optimale', () => {
    const s = loadState(daily(50, 28), TODAY);
    expect(s.acute).toBe(350);
    expect(s.chronic).toBe(350);
    expect(s.ratio).toBe(1);
    expect(s.status).toBe('optimal');
  });

  it('pic soudain → risque', () => {
    const s = loadState([...daily(20, 28), ...daily(200, 7)], TODAY);
    expect(s.ratio!).toBeGreaterThan(1.5);
    expect(s.status).toBe('risque');
  });

  it('semaine de repos → charge basse', () => {
    expect(loadState(daily(50, 21, 7), TODAY).status).toBe('insuffisant');
  });

  it('moins de 3 semaines d’historique : pas de ratio ni d’alerte', () => {
    const s = loadState(daily(60, 5), TODAY);
    expect(s).toMatchObject({ acute: 300, ratio: null, status: 'historique' });
    // Une seule séance (cas d'un nouvel utilisateur)
    expect(loadState(daily(300, 1), TODAY).status).toBe('historique');
  });

  it("historique hebdomadaire de la bonne longueur", () => {
    expect(loadHistory(daily(50, 28), 4, TODAY)).toHaveLength(4);
  });
});
