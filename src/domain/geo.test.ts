import { describe, expect, it } from 'vitest';
import { acceptPoint, currentPace, downsample, elevationGain, haversine, kmSplits, trackDistance, type TrackPoint } from './geo';

/** Ligne droite vers le nord : 1° de latitude ≈ 111 195 m. */
const M_PER_DEG = 111_195;
function northLine(meters: number, stepM: number, secondsPerStep: number, start = 0): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let d = 0, i = 0; d <= meters + 1e-6; d += stepM, i++) out.push({ lat: 48 + d / M_PER_DEG, lon: 2, t: start + i * secondsPerStep * 1000 });
  return out;
}

describe('haversine', () => {
  it('Paris → Lyon ≈ 391,5 km', () => {
    expect(haversine({ lat: 48.8566, lon: 2.3522 }, { lat: 45.764, lon: 4.8357 }) / 1000).toBeCloseTo(391.5, 0);
  });
  it('distance nulle', () => expect(haversine({ lat: 1, lon: 1 }, { lat: 1, lon: 1 })).toBe(0));
});

describe('acceptPoint', () => {
  const p = { lat: 48, lon: 2, t: 0 };
  it('accepte le premier point précis', () => expect(acceptPoint(undefined, { ...p, acc: 10 })).toBe(true));
  it('rejette un point imprécis', () => expect(acceptPoint(undefined, { ...p, acc: 80 })).toBe(false));
  it('rejette le bruit à l’arrêt', () => expect(acceptPoint(p, { lat: 48 + 1 / M_PER_DEG, lon: 2, t: 5000 })).toBe(false));
  it('rejette un saut irréaliste', () => expect(acceptPoint(p, { lat: 48 + 500 / M_PER_DEG, lon: 2, t: 2000 })).toBe(false));
  it('accepte un déplacement normal', () => expect(acceptPoint(p, { lat: 48 + 15 / M_PER_DEG, lon: 2, t: 5000 })).toBe(true));
});

describe('trace', () => {
  it('distance totale', () => {
    expect(trackDistance(northLine(2000, 10, 3))).toBeCloseTo(2000, 0);
  });

  it('splits au km, y compris à travers une pause', () => {
    // 10 m toutes les 3 s → 300 s/km.
    const line = northLine(2500, 10, 3);
    expect(kmSplits([line])).toEqual([300, 300]);
    // Même trajet coupé en deux portions avec une pause de 10 min : la pause ne compte pas.
    const first = line.slice(0, 151);
    const second = line.slice(150).map((p) => ({ ...p, t: p.t + 600_000 }));
    expect(kmSplits([first, second])).toEqual([300, 300]);
  });

  it('allure instantanée sur la fenêtre récente', () => {
    expect(currentPace(northLine(500, 10, 3))).toBeCloseTo(300, 0);
    expect(currentPace([])).toBeNull();
  });

  it('dénivelé positif avec hystérésis', () => {
    const alts = [100, 101, 100, 102, 105, 103, 110, 108, 115];
    expect(elevationGain(alts.map((alt, i) => ({ lat: 0, lon: 0, t: i, alt })))).toBe(15);
  });

  it('sous-échantillonnage en gardant extrémités', () => {
    const line = northLine(100, 1, 1);
    const ds = downsample(line, 10);
    expect(ds[0]).toBe(line[0]);
    expect(ds[ds.length - 1]).toBe(line[line.length - 1]);
    expect(ds.length).toBeLessThan(15);
  });
});
