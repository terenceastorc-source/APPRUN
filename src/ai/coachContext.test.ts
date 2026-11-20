import { describe, expect, it } from 'vitest';
import { emptyData } from '../storage/database';
import { makeActivity } from '../test/factories';
import { buildCoachContext } from './coachContext';

const TODAY = new Date(2026, 10, 20); // vendredi 20 novembre 2026

describe('buildCoachContext', () => {
  it('ne garde que les données récentes et utiles, triées', () => {
    const data = {
      ...emptyData(),
      settings: { maxHr: 190, aiUrl: 'https://x', aiCode: 'secret' },
      activities: [
        makeActivity({ date: '2026-11-19', sport: 'crossfit', distanceMeters: undefined, durationSeconds: 3600, rpe: 8, crossfit: { format: 'force', level: 'rx', lifts: [{ exercise: 'Back Squat', sets: 5, reps: 5, weightKg: 100 }] } }),
        makeActivity({ date: '2026-11-17', distanceMeters: 10000, durationSeconds: 3000, rpe: 6, runType: 'footing', notes: 'jambes lourdes' }),
        makeActivity({ date: '2026-10-01' }),
      ],
      body: [
        { date: '2026-11-01', weightKg: 75 },
        { date: '2026-11-20', sleepHours: 5.5, form: 2 },
      ],
      plans: [
        { id: 'p1', date: '2026-11-20', sport: 'course' as const, title: '6 × 1000 m', targetDurationMin: 60, program: { id: '10k', instanceId: 'i', name: 'Objectif 10 km · Intermédiaire' } },
        { id: 'p2', date: '2026-11-18', sport: 'course' as const, title: 'Passée' },
        { id: 'p3', date: '2026-12-15', sport: 'velo' as const, title: 'Trop loin' },
      ],
      goals: [{ id: 'g', scope: 'course' as const, metric: 'distance' as const, period: 'week' as const, target: 30 }],
    };
    const ctx = buildCoachContext(data, TODAY);
    expect(ctx.today).toBe('2026-11-20');
    expect(ctx.weekday).toBe('vendredi');
    expect(ctx.profile).toEqual({ maxHr: 190 });
    expect(JSON.stringify(ctx)).not.toContain('secret');
    expect(ctx.recentSessions.map((s) => s.date)).toEqual(['2026-11-17', '2026-11-19']);
    expect(ctx.recentSessions[0]).toMatchObject({ sport: 'Course à pied', minutes: 50, km: 10, rpe: 6, detail: 'Footing · notes : jambes lourdes' });
    expect(ctx.recentSessions[1]!.detail).toBe('Force / Haltéro · Back Squat 5×5 @100 kg');
    expect(ctx.body).toEqual([{ date: '2026-11-20', sleepHours: 5.5, form: 2, weightKg: undefined, restingHr: undefined, notes: undefined }]);
    expect(ctx.planned).toEqual([{ date: '2026-11-20', sport: 'course', title: '6 × 1000 m', minutes: 60, program: 'Objectif 10 km · Intermédiaire' }]);
    expect(ctx.load.acute7d).toBe(300 + 480);
    expect(ctx.goals[0]!.label).toBe('Course à pied par semaine');
    expect(ctx.goals[0]!.progress).toMatch(/^10 \/ 30 km/);
  });
});
