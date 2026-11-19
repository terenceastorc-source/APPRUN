import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { addDays, toIsoDate } from '../domain/format';
import { Database } from '../storage/database';
import { memoryStore } from '../test/factories';

const day = (n: number) => toIsoDate(addDays(new Date(), -n));

function seeded(hash: string) {
  window.location.hash = hash;
  const db = new Database(memoryStore());
  db.addActivity({ sport: 'course', date: day(5), distanceMeters: 10000, durationSeconds: 3000, heartRateAvg: 150, heartRateMax: 185, source: 'manual' });
  const wod = (n: number, score: string, weightKg: number) =>
    db.addActivity({ sport: 'crossfit', date: day(n), durationSeconds: 900, source: 'manual', crossfit: { format: 'for-time', level: 'rx', wodName: 'Fran', score, lifts: [{ exercise: 'Back Squat', sets: 5, reps: 5, weightKg }] } });
  wod(40, '5:10', 100);
  wod(10, '4:20', 105);
  const race = (n: number, sled: number) =>
    db.addActivity({ sport: 'hyrox', date: day(n), durationSeconds: 5000, source: 'manual', race: { official: false, segments: [{ name: 'SkiErg 1000 m', kind: 'station', seconds: 250 }, { name: 'Sled Push 50 m', kind: 'station', seconds: sled }] } });
  race(30, 180);
  race(3, 215);
  render(<App database={db} />);
  return userEvent.setup();
}

describe('Progrès', () => {
  it('course : prédictions et zones cardiaques', () => {
    seeded('#/progres/course');
    expect(screen.getByRole('tab', { name: 'Course', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Semi-marathon')).toBeInTheDocument();
    expect(screen.getByText('50:00')).toBeInTheDocument(); // 10 km prédit = 10 km couru
    expect(screen.getByText(/FC max 185 bpm \(estimée/)).toBeInTheDocument();
  });

  it('CrossFit : progression du benchmark et 1RM', () => {
    seeded('#/progres/crossfit');
    expect(screen.getByLabelText('WOD')).toHaveValue('Fran');
    expect(screen.getByText(/5:10 → 4:20/)).toBeInTheDocument();
    expect(screen.getByText(/122,5 kg/)).toBeInTheDocument(); // 105 × (1 + 5/30)
  });

  it('HYROX : identifie l’atelier à travailler', async () => {
    const user = seeded('#/progres/hyrox');
    expect(screen.getByText('À travailler :', { exact: false })).toHaveTextContent('Sled Push 50 m, 0:35 au-dessus');
    await user.click(screen.getByRole('tab', { name: 'Corps' }));
    expect(screen.getByText('Mesures du jour')).toBeInTheDocument();
  });
});
