import { describe, expect, it } from 'vitest';
import { TIMER_PRESETS, buildPhases, clockElapsed, clockPause, clockResume, clockStart, timerAt, timerTitle, validateTimer, workoutSeconds } from './timer';

describe('buildPhases', () => {
  it('Tabata : 8 efforts, 7 récupérations, préparation', () => {
    const p = buildPhases(TIMER_PRESETS.tabata);
    expect(p[0]).toEqual({ kind: 'prep', seconds: 10, round: 0 });
    expect(p.filter((x) => x.kind === 'work')).toHaveLength(8);
    expect(p.filter((x) => x.kind === 'rest')).toHaveLength(7);
    expect(workoutSeconds(TIMER_PRESETS.tabata)).toBe(8 * 20 + 7 * 10);
  });

  it('EMOM sans récupération, For Time sans limite', () => {
    expect(workoutSeconds(TIMER_PRESETS.emom)).toBe(600);
    expect(workoutSeconds({ ...TIMER_PRESETS['for-time'], durationSeconds: 0 })).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('timerAt', () => {
  const tabata = TIMER_PRESETS.tabata;

  it('préparation puis effort puis récupération', () => {
    expect(timerAt(tabata, 3)).toMatchObject({ phase: 'prep', round: 0, phaseRemaining: 7, workoutElapsed: 0 });
    expect(timerAt(tabata, 10)).toMatchObject({ phase: 'work', round: 1, phaseRemaining: 20, workoutElapsed: 0 });
    expect(timerAt(tabata, 35)).toMatchObject({ phase: 'rest', round: 1, phaseRemaining: 5, workoutElapsed: 25 });
    expect(timerAt(tabata, 40)).toMatchObject({ phase: 'work', round: 2 });
  });

  it('se termine après le dernier effort', () => {
    const end = 10 + 230;
    expect(timerAt(tabata, end - 0.5).phase).toBe('work');
    expect(timerAt(tabata, end)).toMatchObject({ phase: 'done', round: 8, workoutElapsed: 230 });
  });

  it('AMRAP : un seul bloc ; For Time sans limite ne finit jamais', () => {
    expect(timerAt(TIMER_PRESETS.amrap, 10 + 600)).toMatchObject({ phase: 'work', phaseRemaining: 120, workoutElapsed: 600 });
    expect(timerAt(TIMER_PRESETS.amrap, 10 + 720).phase).toBe('done');
    const ft = { ...TIMER_PRESETS['for-time'], durationSeconds: 0 };
    expect(timerAt(ft, 99999)).toMatchObject({ phase: 'work', phaseRemaining: Number.POSITIVE_INFINITY });
  });

  it('sans préparation', () => {
    expect(timerAt({ ...TIMER_PRESETS.emom, prepSeconds: 0 }, 61)).toMatchObject({ phase: 'work', round: 2, workoutElapsed: 61 });
  });
});

describe('horloge', () => {
  it('retire le temps passé en pause', () => {
    let c = clockStart(0);
    c = clockPause(c, 30_000);
    expect(clockElapsed(c, 90_000)).toBe(30);
    c = clockResume(c, 90_000);
    expect(clockElapsed(c, 100_000)).toBe(40);
    expect(clockResume(c, 1)).toBe(c);
  });
});

describe('titres et validation', () => {
  it('titres lisibles', () => {
    expect(timerTitle(TIMER_PRESETS.amrap)).toBe('AMRAP 12 min');
    expect(timerTitle(TIMER_PRESETS.emom)).toBe('EMOM 10 min');
    expect(timerTitle({ ...TIMER_PRESETS.emom, workSeconds: 90 })).toBe('EMOM 10 × 1:30');
    expect(timerTitle(TIMER_PRESETS.tabata)).toBe('Tabata 8 × 20/10');
    expect(timerTitle(TIMER_PRESETS.intervals)).toBe('8 × 1 min / 1 min');
    expect(timerTitle({ ...TIMER_PRESETS['for-time'], durationSeconds: 0 })).toBe('For Time');
  });

  it('refuse les réglages incohérents', () => {
    expect(validateTimer(TIMER_PRESETS.tabata)).toBeNull();
    expect(validateTimer({ ...TIMER_PRESETS.amrap, durationSeconds: 0 })).not.toBeNull();
    expect(validateTimer({ ...TIMER_PRESETS.intervals, rounds: 0 })).not.toBeNull();
    expect(validateTimer({ ...TIMER_PRESETS.emom, workSeconds: 2 })).not.toBeNull();
  });
});
