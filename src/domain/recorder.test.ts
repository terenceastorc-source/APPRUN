import { describe, expect, it } from 'vitest';
import { addPoint, elapsedMs, initialRecorder, pause, resume, start, summarize } from './recorder';

const M = 111_195;
const pt = (meters: number, t: number) => ({ lat: 48 + meters / M, lon: 2, t, acc: 5 });

describe('enregistreur GPS', () => {
  it('chrono actif qui exclut les pauses', () => {
    let s = start(initialRecorder('course'), 0);
    expect(elapsedMs(s, 60_000)).toBe(60_000);
    s = pause(s, 60_000);
    expect(elapsedMs(s, 300_000)).toBe(60_000);
    s = resume(s, 300_000);
    expect(elapsedMs(s, 330_000)).toBe(90_000);
  });

  it('ignore les transitions invalides', () => {
    const idle = initialRecorder('course');
    expect(pause(idle, 1)).toBe(idle);
    expect(resume(idle, 1)).toBe(idle);
    const running = start(idle, 0);
    expect(start(running, 5)).toBe(running);
  });

  it("n'ajoute des points qu'en cours d'enregistrement et filtre le bruit", () => {
    let s = initialRecorder('course');
    s = addPoint(s, pt(0, 0));
    expect(s.segments).toEqual([]);
    s = start(s, 0);
    s = addPoint(s, pt(0, 0));
    s = addPoint(s, pt(1, 1000)); // bruit < 3 m
    s = addPoint(s, { ...pt(20, 6000), acc: 100 }); // imprécis
    s = addPoint(s, pt(20, 6000));
    expect(s.segments[0]).toHaveLength(2);
  });

  it('crée une nouvelle portion à la reprise et résume distance et splits', () => {
    let s = start(initialRecorder('course'), 0);
    // 1,2 km à 5:00/km (10 m toutes les 3 s), pause, puis 0,9 km
    for (let i = 0; i <= 120; i++) s = addPoint(s, pt(i * 10, i * 3000));
    s = pause(s, 360_000);
    s = resume(s, 900_000);
    for (let i = 0; i <= 90; i++) s = addPoint(s, pt(1200 + i * 10, 900_000 + i * 3000));
    const sum = summarize(s, 900_000 + 270_000);
    expect(s.segments).toHaveLength(2);
    expect(sum.distanceMeters).toBe(2100);
    expect(sum.durationSeconds).toBe(360 + 270);
    expect(sum.splits).toEqual([300, 300]);
    expect(sum.currentPace).toBeCloseTo(300, 0);
  });
});
