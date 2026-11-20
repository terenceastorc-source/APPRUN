import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from "vitest";
import { COACH_ADVICE_SCHEMA, WOD_EXTRACTION_SCHEMA } from '../../src/ai/contract';
import { MODEL, handle, type ClientFactory, type Env } from './index';

const env: Env = { ANTHROPIC_API_KEY: 'sk-test', ACCESS_CODE: 'secret-123', ALLOWED_ORIGINS: 'https://app.example' };

const WOD = { readable: true, title: 'Fran', format: 'for-time', wodName: 'Fran', durationMinutes: 0, workout: '21-15-9\nThrusters 43/29 kg\nPull-ups', lifts: [], note: '', confidence: 'haute' };

function fakeClient(reply: Partial<Anthropic.Beta.BetaMessage> | Error) {
  const create = vi.fn(async (_params: unknown) => {
    if (reply instanceof Error) throw reply;
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(WOD) }], ...reply } as Anthropic.Beta.BetaMessage;
  });
  const factory: ClientFactory = () => ({ beta: { messages: { create } } }) as unknown as Pick<Anthropic, 'beta'>;
  return { create, factory };
}

function post(path: string, body: unknown, headers: Record<string, string> = { 'X-Apprun-Code': 'secret-123', Origin: 'https://app.example' }) {
  return new Request(`https://worker.example${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

describe('worker IA', () => {
  it('lit une photo : image + consigne envoyées, sortie structurée, repli et cache activés', async () => {
    const { create, factory } = fakeClient({});
    const res = await handle(post('/wod-photo', { image: 'AAAA', mediaType: 'image/jpeg' }), env, factory);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(WOD);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    const params = create.mock.calls[0]![0] as Record<string, unknown> & { messages: { content: { type: string }[] }[] };
    expect(params.model).toBe(MODEL);
    expect(params.fallbacks).toBe('default');
    expect(params.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(params.output_config).toEqual({ effort: 'medium', format: { type: 'json_schema', schema: WOD_EXTRACTION_SCHEMA } });
    expect((params.system as { cache_control: unknown }[])[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(params.messages[0]!.content.map((c) => c.type)).toEqual(['image', 'text']);
  });

  it('coach : contexte et message de l’athlète transmis', async () => {
    const advice = { status: 'adapt', headline: 'On allège', analysis: '...', session: { sport: 'course', title: 'Footing', durationMinutes: 30, intensity: 'facile', description: '...' }, tips: [] };
    const { create, factory } = fakeClient({ content: [{ type: 'text', text: JSON.stringify(advice), citations: null }] });
    const res = await handle(post('/coach', { context: { today: '2026-11-20', recentSessions: [] }, note: '  mal au mollet  ' }), env, factory);
    expect(await res.json()).toEqual(advice);
    const params = create.mock.calls[0]![0] as { output_config: { format: { schema: unknown } }; messages: { content: { text: string }[] }[] };
    expect(params.output_config.format.schema).toBe(COACH_ADVICE_SCHEMA);
    expect(params.messages[0]!.content[0]!.text).toContain('"today":"2026-11-20"');
    expect(params.messages[0]!.content[1]!.text).toBe("Message de l'athlète : mal au mollet");
  });

  it('refuse sans le bon code d’accès, sans appeler Claude', async () => {
    const { create, factory } = fakeClient({});
    const res = await handle(post('/coach', { context: { today: 'x' } }, { 'X-Apprun-Code': 'mauvais' }), env, factory);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('unauthorized');
    expect(create).not.toHaveBeenCalled();
  });

  it('valide les entrées', async () => {
    const { factory } = fakeClient({});
    expect((await handle(post('/wod-photo', { image: 'AAAA', mediaType: 'image/gif' }), env, factory)).status).toBe(400);
    expect((await handle(post('/wod-photo', { image: 'A'.repeat(7_000_001), mediaType: 'image/png' }), env, factory)).status).toBe(413);
    expect((await handle(post('/coach', {}), env, factory)).status).toBe(400);
    expect((await handle(post('/inconnu', {}), env, factory)).status).toBe(404);
  });

  it('gère refus, réponse tronquée et erreurs de l’API', async () => {
    expect((await handle(post('/coach', { context: { today: 'x' } }), env, fakeClient({ stop_reason: 'refusal', content: [] }).factory)).status).toBe(422);
    expect((await handle(post('/coach', { context: { today: 'x' } }), env, fakeClient({ stop_reason: 'max_tokens' }).factory)).status).toBe(502);
    const rate = new Anthropic.RateLimitError(429, { type: 'error' }, 'rate', new Headers());
    const res = await handle(post('/coach', { context: { today: 'x' } }), env, fakeClient(rate).factory);
    expect(res.status).toBe(503);
  });

  it('CORS : pré-vol et origine non autorisée', async () => {
    const pre = await handle(new Request('https://worker.example/coach', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }), env);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    const { factory } = fakeClient({});
    const other = await handle(post('/coach', { context: { today: 'x' } }, { 'X-Apprun-Code': 'secret-123', Origin: 'https://pirate.example' }), env, factory);
    expect(other.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
  });

  it('serveur mal configuré', async () => {
    const res = await handle(post('/coach', { context: { today: 'x' } }), { ...env, ACCESS_CODE: '' }, fakeClient({}).factory);
    expect(res.status).toBe(500);
  });
});
