import { describe, expect, it } from 'vitest';
import { makeActivity } from '../test/factories';
import { emptyData } from './database';
import { exportCsv, exportJson, ImportError, parseImport } from './exchange';

describe('import / export', () => {
  it('aller-retour complet avec traces', () => {
    const data = { ...emptyData(), activities: [makeActivity({ notes: 'côte' })], body: [{ date: '2026-11-01', weightKg: 70 }] };
    const tracks = [{ activityId: data.activities[0]!.id, segments: [[{ lat: 1, lon: 2, t: 3 }]] }];
    expect(parseImport(exportJson(data, tracks))).toEqual({ data, tracks });
  });

  it("accepte l'ancien export v1 et un tableau brut", () => {
    const run = { id: 'r', date: '2026-11-01', distanceMeters: 5000, durationSeconds: 1500, type: 'footing', createdAt: 'c', updatedAt: 'u' };
    expect(parseImport(JSON.stringify({ app: 'apprun', version: 1, runs: [run] })).data.activities[0]!.sport).toBe('course');
    expect(parseImport(JSON.stringify([run])).data.activities).toHaveLength(1);
  });

  it('signale un fichier invalide', () => {
    expect(() => parseImport('nope')).toThrow(ImportError);
    expect(() => parseImport('{"autre":1}')).toThrow(ImportError);
  });

  it('CSV avec sport, allure et échappement', () => {
    const csv = exportCsv([makeActivity({ distanceMeters: 10500, durationSeconds: 3150, notes: 'pluie; vent "fort"' }), makeActivity({ sport: 'crossfit', distanceMeters: undefined, durationSeconds: 1200, crossfit: { format: 'for-time', level: 'rx', wodName: 'Fran', score: '4:30' } })]);
    const [header, row1, row2] = csv.split('\n');
    expect(header!.split(';')).toHaveLength(14);
    expect(row1).toBe(`2026-11-16;;Course à pied;;52:30;10,50;"5'00""/km";;;;;;;"pluie; vent ""fort"""`);
    expect(row2).toBe('2026-11-16;;CrossFit;;20:00;;;;;;;Fran;4:30;');
  });
});
