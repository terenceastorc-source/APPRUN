import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { addDays, toIsoDate } from '../domain/format';
import { Database } from '../storage/database';
import { memoryStore } from '../test/factories';

describe('Programmes', () => {
  it('choisit un programme, le place avant la course et le suit dans le Plan', async () => {
    window.location.hash = '#/plan';
    const db = new Database(memoryStore());
    const user = userEvent.setup();
    render(<App database={db} />);

    await user.click(screen.getByRole('button', { name: 'Choisir un programme' }));
    await user.click(screen.getByRole('button', { name: /Préparation HYROX/ }));
    await user.click(screen.getByRole('button', { name: 'Débutant' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter au calendrier' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choisis la date de ta course');

    // Trop proche
    await user.type(screen.getByLabelText('Date de la course'), toIsoDate(addDays(new Date(), 14)));
    expect(screen.getByRole('alert')).toHaveTextContent(/Il faut 8 semaines/);

    const race = toIsoDate(addDays(new Date(), 70));
    const input = screen.getByLabelText('Date de la course');
    await user.clear(input);
    await user.type(input, race);
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Semaine 6/ }));
    expect(screen.getByText('Simulation HYROX complète')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajouter au calendrier' }));

    const plans = db.snapshot().plans;
    expect(plans.length).toBeGreaterThan(25);
    expect(plans.every((p) => p.program?.name === 'Préparation HYROX · Débutant')).toBe(true);
    expect(plans.find((p) => p.date === race)?.title).toBe('Course HYROX 🏁');
    expect(await screen.findByText(/séances ajoutées au calendrier/)).toBeInTheDocument();

    const card = screen.getByRole('heading', { name: 'Programmes' }).closest('section')!;
    expect(within(card).getByText('Préparation HYROX · Débutant')).toBeInTheDocument();
    expect(within(card).getByText(`0/${plans.length}`)).toBeInTheDocument();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(within(card).getByRole('button', { name: 'Arrêter le programme' }));
    expect(db.snapshot().plans).toHaveLength(0);
  });
});
