import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { toIsoDate } from '../domain/format';
import { Database } from '../storage/database';
import { memoryStore } from '../test/factories';

vi.mock('../lib/image', () => ({ photoToJpegBase64: vi.fn(async () => ({ data: 'BASE64', mediaType: 'image/jpeg' })) }));

const today = toIsoDate(new Date());

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function setup(hash: string, configured = true) {
  window.location.hash = hash;
  const db = new Database(memoryStore());
  if (configured) db.updateSettings({ aiUrl: 'https://ia.example/', aiCode: 'code-42' });
  db.addActivity({ sport: 'course', date: today, durationSeconds: 3000, distanceMeters: 10000, rpe: 6, source: 'manual' });
  render(<App database={db} />);
  return { db, user: userEvent.setup() };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('Photo du WOD', () => {
  const extraction = {
    readable: true,
    title: 'Fran',
    format: 'for-time',
    wodName: 'Fran',
    durationMinutes: 10,
    workout: '21-15-9\nThrusters 43/29 kg\nPull-ups',
    lifts: [{ exercise: 'Back Squat', sets: 5, reps: 5, weightKg: 100 }],
    note: 'La charge des thrusters était à moitié effacée.',
    confidence: 'moyenne',
  };

  it('envoie la photo et pré-remplit la séance', async () => {
    fetchMock.mockReturnValueOnce(reply(200, extraction));
    const { user } = setup('#/ajouter');
    await user.upload(screen.getByTestId('wod-photo-input'), new File(['x'], 'wod.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByText(/Rempli depuis ta photo \(lecture moyenne\)/)).toHaveTextContent('thrusters était à moitié effacée');
    expect(screen.getByLabelText('Titre')).toHaveValue('Fran');
    expect(screen.getByLabelText('Nom du WOD (benchmark)')).toHaveValue('Fran');
    expect(screen.getByLabelText('Format')).toHaveValue('for-time');
    expect(screen.getByLabelText('Contenu de la séance')).toHaveValue('21-15-9\nThrusters 43/29 kg\nPull-ups');
    expect(screen.getByLabelText('Charge 1')).toHaveValue('100');
    expect(screen.getByLabelText('Durée')).toHaveValue(''); // un For Time n'a pas de durée connue d'avance

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://ia.example/wod-photo');
    expect(init.headers['X-Apprun-Code']).toBe('code-42');
    expect(JSON.parse(init.body)).toEqual({ image: 'BASE64', mediaType: 'image/jpeg' });
  });

  it('explique quand la photo est illisible', async () => {
    fetchMock.mockReturnValueOnce(reply(200, { ...extraction, readable: false, note: 'Photo trop floue.' }));
    const { user } = setup('#/ajouter');
    await user.upload(screen.getByTestId('wod-photo-input'), new File(['x'], 'wod.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo trop floue.');
  });

  it('invite à configurer le serveur sinon', () => {
    setup('#/ajouter', false);
    expect(screen.getByText(/configure le coach IA/)).toBeInTheDocument();
    expect(screen.queryByTestId('wod-photo-input')).toBeNull();
  });
});

describe('Coach du jour', () => {
  const advice = {
    status: 'adapt',
    headline: 'Sommeil court : on garde le volume, pas l’intensité',
    analysis: 'Tu as couru 10 km aujourd’hui à RPE 6.',
    session: { sport: 'course', title: 'Footing récupération', durationMinutes: 35, intensity: 'facile', description: '35 min en aisance respiratoire.' },
    tips: ['Couche-toi avant 23 h.'],
  };

  it('envoie le contexte, affiche le conseil et l’ajoute au plan', async () => {
    fetchMock.mockReturnValueOnce(reply(200, advice));
    const { user, db } = setup('#/');
    const card = screen.getByRole('heading', { name: '🧠 Coach du jour' }).closest('section')!;
    await user.type(within(card).getByLabelText(/Ton contexte/), '40 min dispo');
    await user.click(within(card).getByRole('button', { name: 'Demander au coach' }));

    expect(await within(card).findByText(advice.headline)).toBeInTheDocument();
    expect(within(card).getByText('Séance adaptée')).toBeInTheDocument();
    expect(within(card).getByText('35 min · facile')).toBeInTheDocument();

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.note).toBe('40 min dispo');
    expect(body.context.today).toBe(today);
    expect(body.context.recentSessions).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain('code-42');

    await user.click(within(card).getByRole('button', { name: 'Ajouter à mon plan' }));
    expect(db.snapshot().plans[0]).toMatchObject({ date: today, sport: 'course', title: 'Footing récupération', targetDurationMin: 35 });
    expect(within(card).getByRole('button', { name: 'Ajoutée au plan ✓' })).toBeDisabled();
  });

  it('garde le conseil du jour sans rappeler le serveur', async () => {
    localStorage.setItem('apprun:coach', JSON.stringify({ date: today, note: '', advice }));
    setup('#/');
    expect(screen.getByText(advice.headline)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('affiche l’erreur du serveur', async () => {
    fetchMock.mockReturnValueOnce(reply(401, { error: { code: 'unauthorized', message: "Code d'accès incorrect." } }));
    const { user } = setup('#/');
    await user.click(screen.getByRole('button', { name: 'Demander au coach' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Code d'accès incorrect.");
  });
});

describe('Réglages du coach IA', () => {
  it('teste la connexion sans appeler Claude, puis enregistre', async () => {
    fetchMock.mockReturnValueOnce(reply(400, { error: { code: 'bad_request', message: 'Contexte manquant.' } }));
    const { user, db } = setup('#/reglages', false);
    await user.type(screen.getByLabelText('Adresse du serveur'), 'https://apprun-ai.moi.workers.dev');
    await user.type(screen.getByLabelText("Code d'accès"), 'abc');
    await user.click(screen.getByRole('button', { name: 'Tester la connexion' }));
    expect(await screen.findByText('Connexion au serveur IA réussie ✓')).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({});

    await user.click(screen.getAllByRole('button', { name: 'Enregistrer' })[1]!);
    expect(db.snapshot().settings).toMatchObject({ aiUrl: 'https://apprun-ai.moi.workers.dev', aiCode: 'abc' });
  });
});
