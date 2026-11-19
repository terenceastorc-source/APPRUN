import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { toIsoDate } from './domain/format';
import { Database, STORAGE_KEY } from './storage/database';
import { memoryStore } from './test/factories';

function setup(opts: { hash?: string; seed?: (db: Database) => void; store?: ReturnType<typeof memoryStore> } = {}) {
  window.location.hash = opts.hash ?? '';
  const database = new Database(opts.store ?? memoryStore());
  opts.seed?.(database);
  const user = userEvent.setup();
  render(<App database={database} />);
  return { user, database };
}

const today = toIsoDate(new Date());

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it("affiche l'accueil vide puis le choix du sport", async () => {
    const { user } = setup();
    expect(screen.getByText(/Bienvenue sur APPRUN/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajouter une séance' }));
    expect(await screen.findByRole('button', { name: /HYROX/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Course à pied/ })).toHaveLength(2); // GPS + saisie
  });

  it('saisit une course et met à jour le tableau de bord', async () => {
    const { user, database } = setup({ hash: '#/ajouter/course' });
    await user.type(screen.getByLabelText('Durée'), '50:00');
    await user.type(screen.getByLabelText('Distance (km)'), '10');
    expect(screen.getByText(`5'00"/km`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '7' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter la séance' }));

    const [a] = database.snapshot().activities;
    expect(a).toMatchObject({ sport: 'course', distanceMeters: 10000, durationSeconds: 3000, rpe: 7, date: today, source: 'manual' });
    // Détail de la séance puis tableau de bord
    expect(await screen.findByText('350 pts')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Accueil/ }));
    expect(await screen.findByText('Cette semaine')).toBeInTheDocument();
    expect(screen.getAllByText('10 km').length).toBeGreaterThan(0);
  });

  it('saisit un WOD CrossFit avec exercices de force', async () => {
    const { user, database } = setup({ hash: '#/ajouter/crossfit' });
    await user.type(screen.getByLabelText('Durée'), '12:00');
    await user.type(screen.getByLabelText('Nom du WOD (benchmark)'), 'Fran');
    await user.type(screen.getByLabelText('Score'), '4:32');
    await user.click(screen.getByRole('button', { name: '+ Ajouter un exercice' }));
    await user.type(screen.getByLabelText('Exercice 1'), 'Back Squat');
    await user.type(screen.getByLabelText('Séries 1'), '5');
    await user.type(screen.getByLabelText('Répétitions 1'), '5');
    await user.type(screen.getByLabelText('Charge 1'), '100');
    await user.click(screen.getByRole('button', { name: 'Ajouter la séance' }));

    expect(database.snapshot().activities[0]!.crossfit).toEqual({
      format: 'for-time',
      level: 'rx',
      wodName: 'Fran',
      score: '4:32',
      lifts: [{ exercise: 'Back Squat', sets: 5, reps: 5, weightKg: 100 }],
    });
    expect(await screen.findByText('117 kg')).toBeInTheDocument(); // 1RM estimé (Epley)
  });

  it('saisit un HYROX segment par segment, durée = somme des segments', async () => {
    const { user, database } = setup({ hash: '#/ajouter/hyrox' });
    await user.click(screen.getByRole('button', { name: 'Course officielle' }));
    await user.type(screen.getByLabelText('Temps Course 1'), '4:30');
    await user.type(screen.getByLabelText('Temps SkiErg 1000 m'), '4:10');
    await user.click(screen.getByRole('button', { name: 'Ajouter la séance' }));

    const a = database.snapshot().activities[0]!;
    expect(a.durationSeconds).toBe(520);
    expect(a.race!.official).toBe(true);
    expect(a.race!.segments).toHaveLength(17);
    expect(await screen.findByText(/Course officielle/)).toBeInTheDocument();
  });

  it('affiche les erreurs de validation', async () => {
    const { user, database } = setup({ hash: '#/ajouter/velo' });
    await user.click(screen.getByRole('button', { name: 'Ajouter la séance' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2); // durée + distance
    expect(database.snapshot().activities).toHaveLength(0);
  });

  it('planifie une séance puis la valide comme réalisée', async () => {
    const { user, database } = setup({ hash: '#/plan' });
    await user.click(screen.getByRole('button', { name: '+ Planifier' }));
    const form = screen.getByRole('form', { name: 'Séance planifiée' });
    await user.selectOptions(within(form).getByLabelText('Sport'), 'crossfit');
    await user.type(within(form).getByLabelText('Titre'), 'Murph');
    await user.type(within(form).getByLabelText('Durée prévue (min)'), '45');
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    expect(database.snapshot().plans[0]).toMatchObject({ sport: 'crossfit', title: 'Murph', targetDurationMin: 45, date: today });

    await user.click(screen.getByRole('button', { name: 'Fait ✓' }));
    expect(screen.getByLabelText('Titre')).toHaveValue('Murph');
    expect(screen.getByLabelText('Durée')).toHaveValue('45:00');
    await user.click(screen.getByRole('button', { name: 'Ajouter la séance' }));
    const { activities, plans } = database.snapshot();
    expect(plans[0]!.activityId).toBe(activities[0]!.id);
    expect(activities[0]!.planId).toBe(plans[0]!.id);
  });

  it('crée un objectif et affiche sa progression', async () => {
    const { user } = setup({
      hash: '#/plan',
      seed: (db) => db.addActivity({ sport: 'course', date: today, durationSeconds: 1800, distanceMeters: 6000, source: 'manual' }),
    });
    await user.click(screen.getByRole('button', { name: '+ Objectif' }));
    const form = screen.getByRole('form', { name: 'Nouvel objectif' });
    await user.selectOptions(within(form).getByLabelText('Pour'), 'course');
    await user.selectOptions(within(form).getByLabelText('Mesure'), 'distance');
    await user.type(within(form).getByLabelText('Cible (km)'), '20');
    await user.click(within(form).getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByText(/6 \/ 20 km · 30 %/)).toBeInTheDocument();
  });

  it('enregistre des mesures corporelles', async () => {
    const { user, database } = setup({ hash: '#/corps' });
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Renseigne au moins une mesure');
    await user.type(screen.getByLabelText('Poids (kg)'), '72,4');
    await user.type(screen.getByLabelText('Sommeil (h)'), '7,5');
    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(database.snapshot().body).toEqual([{ date: today, weightKg: 72.4, sleepHours: 7.5, form: 4 }]);
    expect(screen.getByText('Mesures enregistrées.')).toBeInTheDocument();
  });

  it('modifie puis supprime une séance', async () => {
    const { user, database } = setup({
      hash: '#/journal',
      seed: (db) => db.addActivity({ sport: 'course', date: '2026-11-10', durationSeconds: 2400, distanceMeters: 8000, source: 'manual' }),
    });
    await user.click(screen.getByRole('button', { name: /Course à pied/ }));
    await user.click(await screen.findByRole('button', { name: 'Modifier' }));
    const dist = screen.getByLabelText('Distance (km)');
    await user.clear(dist);
    await user.type(dist, '12');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(database.snapshot().activities[0]!.distanceMeters).toBe(12000);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }));
    expect(database.snapshot().activities).toHaveLength(0);
  });

  it("reprend les données de l'ancienne version (course uniquement)", () => {
    const v1 = { version: 1, runs: [{ id: 'r1', date: '2026-11-01', distanceMeters: 10000, durationSeconds: 3000, type: 'footing', createdAt: 'c', updatedAt: 'u' }], settings: { weeklyGoalKm: 25 } };
    setup({ hash: '#/journal', store: memoryStore({ [STORAGE_KEY]: JSON.stringify(v1) }) });
    expect(screen.getByRole('button', { name: /Footing/ })).toBeInTheDocument();
  });
});
