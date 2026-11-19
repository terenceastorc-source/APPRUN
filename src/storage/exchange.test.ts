import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/factories';
import { exportCsv, exportJson, ImportError, parseJsonImport } from './exchange';

describe('import / export JSON', () => {
  it('fait un aller-retour sans perte', () => {
    const runs = [makeRun({ notes: 'côte' }), makeRun({ type: 'trail', elevationGain: 400 })];
    expect(parseJsonImport(exportJson(runs))).toEqual({ runs, skipped: 0 });
  });

  it('accepte un tableau brut et ignore les entrées invalides', () => {
    const text = JSON.stringify([makeRun(), { foo: 1 }]);
    const res = parseJsonImport(text);
    expect(res.runs).toHaveLength(1);
    expect(res.skipped).toBe(1);
  });

  it('signale un fichier invalide', () => {
    expect(() => parseJsonImport('nope')).toThrow(ImportError);
    expect(() => parseJsonImport('{"autre":true}')).toThrow(ImportError);
  });
});

describe('export CSV', () => {
  it('produit un en-tête et échappe les cellules spéciales', () => {
    const csv = exportCsv([makeRun({ distanceMeters: 10500, durationSeconds: 3150, notes: 'pluie; vent "fort"' })]);
    const [header, row] = csv.split('\n');
    expect(header).toContain('Distance (km)');
    expect(row).toBe(`2026-11-16;Footing;10,50;52:30;"5'00""/km";;;;"pluie; vent ""fort"""`);
  });
});
