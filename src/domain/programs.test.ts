import { describe, expect, it } from 'vitest';
import { parseLocalDate } from './format';
import { LEVELS, PROGRAMS, activePrograms, programById, scheduleProgram } from './programs';
import type { PlannedSession } from './types';

const TODAY = new Date(2026, 10, 19); // jeudi 19 novembre 2026

describe('catalogue', () => {
  it.each(PROGRAMS.map((p) => [p.id, p] as const))('%s : une semaine par semaine du programme, séances valides', (_, def) => {
    for (const level of LEVELS) {
      const weeks = def.build(level);
      expect(weeks).toHaveLength(def.weeks);
      for (const week of weeks) {
        expect(week.length).toBeGreaterThan(0);
        for (const s of week) {
          expect(s.day).toBeGreaterThanOrEqual(0);
          expect(s.day).toBeLessThanOrEqual(6);
          expect(s.title.trim()).not.toBe('');
          expect(s.durationMin ?? s.distanceKm).toBeGreaterThan(0);
        }
      }
    }
  });

  it('le volume augmente avec le niveau', () => {
    const def = programById('10k')!;
    const total = (level: (typeof LEVELS)[number]) => def.build(level).flat().reduce((s, x) => s + (x.distanceKm ?? 0), 0);
    expect(total('debutant')).toBeLessThan(total('intermediaire'));
    expect(total('intermediaire')).toBeLessThan(total('confirme'));
  });
});

describe('scheduleProgram', () => {
  const def = programById('10k')!;

  it('cale la dernière semaine sur la date de course et ajoute le Jour J', () => {
    const res = scheduleProgram(def, 'intermediaire', { raceDate: '2027-02-14', today: TODAY, instanceId: 'i1' });
    if ('error' in res) throw new Error(res.error);
    // 14/02/2027 est un dimanche : semaine du 8/02, début 7 semaines plus tôt.
    expect(res.start).toBe('2026-12-21');
    expect(parseLocalDate(res.start).getDay()).toBe(1);
    const last = res.sessions[res.sessions.length - 1]!;
    expect(last).toMatchObject({ date: '2027-02-14', sport: 'course', title: 'Course 10 km 🏁' });
    expect(res.sessions.every((s) => s.date <= '2027-02-14' && s.program?.instanceId === 'i1')).toBe(true);
    expect(res.sessions.filter((s) => s.date === '2027-02-14')).toHaveLength(1);
    expect(res.sessions[0]!.description).toMatch(/^S1 · /);
  });

  it('refuse une course trop proche', () => {
    const res = scheduleProgram(def, 'debutant', { raceDate: '2026-12-06', today: TODAY, instanceId: 'x' });
    expect('error' in res && res.error).toMatch(/8 semaines.*3 semaines/);
  });

  it('sans date : démarre lundi prochain, sans Jour J', () => {
    const res = scheduleProgram(programById('crossfit-base')!, 'debutant', { today: TODAY, instanceId: 'c' });
    if ('error' in res) throw new Error(res.error);
    expect(res.start).toBe('2026-11-23');
    expect(res.sessions.some((s) => s.title.includes('🏁'))).toBe(false);
    expect(res.sessions.filter((s) => s.title.startsWith('Benchmark'))).toHaveLength(4);
  });
});

describe('activePrograms', () => {
  it('avancement, séances manquées et prochaine séance', () => {
    const tag = { id: '10k', instanceId: 'i1', name: 'Objectif 10 km · Débutant' };
    const plans: PlannedSession[] = [
      { id: 'a', date: '2026-11-10', sport: 'course', title: 'A', program: tag, activityId: 'x' },
      { id: 'b', date: '2026-11-12', sport: 'course', title: 'B', program: tag },
      { id: 'c', date: '2026-11-20', sport: 'course', title: 'C', program: tag },
      { id: 'd', date: '2026-11-25', sport: 'course', title: 'D', program: tag },
      { id: 'e', date: '2026-11-21', sport: 'velo', title: 'Hors programme' },
    ];
    expect(activePrograms(plans, '2026-11-19')).toEqual([
      { instanceId: 'i1', programId: '10k', name: tag.name, total: 4, done: 1, missed: 1, start: '2026-11-10', end: '2026-11-25', next: plans[2] },
    ]);
  });
});
