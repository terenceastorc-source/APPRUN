import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { Database } from '../storage/database';
import { memoryStore } from '../test/factories';

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }));
afterEach(() => vi.useRealTimers());

describe('Chrono AMRAP', () => {
  it('compte les tours, se termine seul et pré-remplit la séance', async () => {
    window.location.hash = '#/chrono/amrap';
    const database = new Database(memoryStore());
    const user = userEvent.setup({ delay: null });
    render(<App database={database} />);

    const duration = screen.getByLabelText('Durée');
    await user.clear(duration);
    await user.type(duration, '1');
    await user.selectOptions(screen.getByLabelText('Compte à rebours'), '0');
    expect(screen.getByText(/AMRAP 1 min · durée totale/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '▶ Démarrer' }));

    await act(async () => void vi.advanceTimersByTime(20_000));
    expect(screen.getByRole('timer')).toHaveTextContent('0:40');
    await user.click(screen.getByRole('button', { name: 'Ajouter un tour' }));
    await act(async () => void vi.advanceTimersByTime(20_000));
    await user.click(screen.getByRole('button', { name: 'Ajouter un tour' }));
    await act(async () => void vi.advanceTimersByTime(21_000));

    expect(screen.getByText(/tours complets/)).toHaveTextContent('2 tours complets');
    await user.type(screen.getByLabelText('Répétitions du tour incomplet'), '5');
    expect(screen.getByText('2+5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer la séance' }));

    expect(screen.getByLabelText('Titre')).toHaveValue('AMRAP 1 min');
    expect(screen.getByLabelText('Durée')).toHaveValue('1:00');
    expect(screen.getByLabelText('Format')).toHaveValue('amrap');
    expect(screen.getByLabelText('Score')).toHaveValue('2+5');
  });

  it('pause : le temps ne défile plus', async () => {
    window.location.hash = '#/chrono/for-time';
    render(<App database={new Database(memoryStore())} />);
    const user = userEvent.setup({ delay: null });
    await user.selectOptions(screen.getByLabelText('Compte à rebours'), '0');
    await user.click(screen.getByRole('button', { name: '▶ Démarrer' }));
    await act(async () => void vi.advanceTimersByTime(5_000));
    await user.click(screen.getByRole('button', { name: '⏸ Pause' }));
    const shown = screen.getByRole('timer').textContent;
    await act(async () => void vi.advanceTimersByTime(30_000));
    expect(screen.getByRole('timer').textContent).toBe(shown);
    expect(screen.getByText('En pause')).toBeInTheDocument();
  });
});
