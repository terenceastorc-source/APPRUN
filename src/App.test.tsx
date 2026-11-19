import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { toIsoDate } from './domain/format';
import { RunRepository } from './storage/repository';
import { memoryStore } from './test/factories';

function setup(seed?: (repo: RunRepository) => void) {
  window.location.hash = '';
  const repository = new RunRepository(memoryStore());
  seed?.(repository);
  const user = userEvent.setup();
  render(<App repository={repository} />);
  return { user, repository };
}

describe('App', () => {
  it("affiche l'écran d'accueil vide", () => {
    setup();
    expect(screen.getByText(/Bienvenue sur APPRUN/)).toBeInTheDocument();
  });

  it('ajoute une sortie et met à jour le tableau de bord', async () => {
    const { user, repository } = setup();
    await user.click(screen.getByRole('button', { name: 'Ajouter une sortie' }));

    await user.type(screen.getByLabelText('Distance (km)'), '10');
    await user.type(screen.getByLabelText('Durée'), '50:00');
    expect(screen.getByText(`5'00"/km`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter la sortie' }));

    expect(repository.getRuns()).toHaveLength(1);
    expect(repository.getRuns()[0]).toMatchObject({ distanceMeters: 10000, durationSeconds: 3000, effort: 4, date: toIsoDate(new Date()) });
    expect(screen.getByText('Objectif de la semaine')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
  });

  it('affiche les erreurs de validation', async () => {
    const { user, repository } = setup();
    await user.click(screen.getByRole('button', { name: /Ajouter$/ }));
    await user.click(screen.getByRole('button', { name: 'Ajouter la sortie' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(repository.getRuns()).toHaveLength(0);
  });

  it("modifie puis supprime une sortie depuis l'historique", async () => {
    const { user, repository } = setup((r) => r.add({ date: '2026-11-10', distanceMeters: 8000, durationSeconds: 2400, type: 'footing' }));
    const app = screen;

    await user.click(app.getByRole('button', { name: /Historique/ }));
    await user.click(app.getByRole('button', { name: /Modifier la sortie/ }));
    const distance = app.getByLabelText('Distance (km)');
    await user.clear(distance);
    await user.type(distance, '12');
    await user.click(app.getByRole('button', { name: 'Enregistrer' }));
    expect(repository.getRuns()[0]!.distanceMeters).toBe(12000);
    expect(app.getByText('12 km')).toBeInTheDocument();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(app.getByRole('button', { name: /Supprimer la sortie/ }));
    expect(repository.getRuns()).toHaveLength(0);
  });
});
