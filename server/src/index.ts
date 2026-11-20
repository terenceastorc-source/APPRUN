import Anthropic from '@anthropic-ai/sdk';
import {
  COACH_ADVICE_SCHEMA,
  WOD_EXTRACTION_SCHEMA,
  type ApiError,
  type CoachAdvice,
  type CoachRequest,
  type WodExtraction,
  type WodPhotoRequest,
} from '../../src/ai/contract';
import { COACH_SYSTEM, WOD_SYSTEM } from './prompts';

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Code partagé avec l'app : empêche que n'importe qui utilise ta clé via l'URL publique du worker. */
  ACCESS_CODE: string;
  /** Origines autorisées, séparées par des virgules (ex. https://moi.github.io). */
  ALLOWED_ORIGINS: string;
}

export const MODEL = 'claude-opus-5-5';
const MAX_IMAGE_BASE64 = 7_000_000; // ~5 Mo d'image
const MAX_BODY = 8_000_000;
const MAX_NOTE = 1000;

/** Fabrique de client injectable pour les tests. */
export type ClientFactory = (env: Env) => Pick<Anthropic, 'beta'>;
const defaultFactory: ClientFactory = (env) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ApiError['error']['code'],
    message: string,
  ) {
    super(message);
  }
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  const ok = origin && (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Apprun-Code',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

/** Comparaison en temps constant du code d'accès. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Appel à Claude en sortie structurée : le JSON renvoyé respecte le schéma.
 * Les refus de sécurité sont relayés vers un modèle de repli côté serveur (`fallbacks: "default"`).
 */
async function callClaude<T>(
  client: Pick<Anthropic, 'beta'>,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  schema: Record<string, unknown>,
): Promise<T> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(502, 'upstream', 'Clé API Anthropic invalide côté serveur.');
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(503, 'upstream', 'Trop de demandes, réessaie dans une minute.');
    if (err instanceof Anthropic.BadRequestError) throw new HttpError(400, 'bad_request', `Requête refusée par l'API : ${err.message}`);
    if (err instanceof Anthropic.APIError) throw new HttpError(502, 'upstream', `Erreur de l'API (${err.status ?? 'réseau'}).`);
    throw err;
  }
  if (response.stop_reason === 'refusal') throw new HttpError(422, 'refused', 'Le modèle a refusé de traiter cette demande.');
  if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'upstream', 'Réponse incomplète, réessaie.');
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
  if (!text) throw new HttpError(502, 'upstream', 'Réponse vide du modèle.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(502, 'upstream', 'Réponse illisible du modèle.');
  }
}

export async function handleWodPhoto(body: unknown, client: Pick<Anthropic, 'beta'>): Promise<WodExtraction> {
  const req = body as Partial<WodPhotoRequest>;
  if (typeof req?.image !== 'string' || !req.image) throw new HttpError(400, 'bad_request', 'Image manquante.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.mediaType ?? '')) throw new HttpError(400, 'bad_request', "Format d'image non pris en charge (JPEG, PNG ou WebP).");
  if (req.image.length > MAX_IMAGE_BASE64) throw new HttpError(413, 'too_large', 'Image trop lourde (5 Mo maximum).');
  return callClaude<WodExtraction>(
    client,
    WOD_SYSTEM,
    [
      { type: 'image', source: { type: 'base64', media_type: req.mediaType as WodPhotoRequest['mediaType'], data: req.image } },
      { type: 'text', text: 'Transcris la séance de cette photo.' },
    ],
    WOD_EXTRACTION_SCHEMA,
  );
}

export async function handleCoach(body: unknown, client: Pick<Anthropic, 'beta'>): Promise<CoachAdvice> {
  const req = body as Partial<CoachRequest>;
  if (typeof req?.context !== 'object' || req.context === null || typeof req.context.today !== 'string') throw new HttpError(400, 'bad_request', 'Contexte manquant.');
  const note = typeof req.note === 'string' ? req.note.slice(0, MAX_NOTE).trim() : '';
  const payload = JSON.stringify(req.context);
  if (payload.length > 200_000) throw new HttpError(413, 'too_large', 'Contexte trop volumineux.');
  return callClaude<CoachAdvice>(
    client,
    COACH_SYSTEM,
    [
      { type: 'text', text: `Données de l'athlète :\n${payload}` },
      { type: 'text', text: note ? `Message de l'athlète : ${note}` : "L'athlète n'a pas laissé de message." },
    ],
    COACH_ADVICE_SCHEMA,
  );
}

export async function handle(request: Request, env: Env, factory: ClientFactory = defaultFactory): Promise<Response> {
  const cors = corsHeaders(request.headers.get('Origin'), env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  try {
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (request.method !== 'POST' || !['/wod-photo', '/coach'].includes(path)) throw new HttpError(404, 'not_found', 'Route inconnue.');
    if (!env.ANTHROPIC_API_KEY || !env.ACCESS_CODE) throw new HttpError(500, 'upstream', 'Serveur mal configuré (secrets manquants).');
    if (!safeEqual(request.headers.get('X-Apprun-Code') ?? '', env.ACCESS_CODE)) throw new HttpError(401, 'unauthorized', "Code d'accès incorrect.");
    const length = Number(request.headers.get('Content-Length') ?? 0);
    if (length > MAX_BODY) throw new HttpError(413, 'too_large', 'Requête trop volumineuse.');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, 'bad_request', 'JSON invalide.');
    }
    const client = factory(env);
    const result = path === '/wod-photo' ? await handleWodPhoto(body, client) : await handleCoach(body, client);
    return json(result, 200, cors);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: { code: err.code, message: err.message } } satisfies ApiError, err.status, cors);
    console.error(err);
    return json({ error: { code: 'upstream', message: 'Erreur interne.' } } satisfies ApiError, 500, cors);
  }
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
