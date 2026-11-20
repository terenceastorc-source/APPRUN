import type { Settings } from '../domain/types';
import type { ApiError } from './contract';

export class AiError extends Error {
  constructor(
    message: string,
    public code: ApiError['error']['code'] | 'not_configured' | 'network' | 'timeout' | 'invalid',
  ) {
    super(message);
  }
}

export function aiConfigured(s: Settings): boolean {
  return !!s.aiUrl?.trim() && !!s.aiCode?.trim();
}

/** Appelle le serveur IA et vérifie la forme de la réponse. */
export async function aiRequest<T>(settings: Settings, path: '/wod-photo' | '/coach', body: unknown, guard: (v: unknown) => v is T, timeoutMs = 120_000): Promise<T> {
  if (!aiConfigured(settings)) throw new AiError("Le serveur IA n'est pas configuré (Réglages → Coach IA).", 'not_configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(settings.aiUrl!.trim().replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Apprun-Code': settings.aiCode!.trim() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new AiError("Le serveur IA met trop de temps à répondre. Réessaie.", 'timeout');
    throw new AiError('Serveur IA injoignable. Vérifie ta connexion et l’adresse dans les réglages.', 'network');
  } finally {
    clearTimeout(timer);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AiError(`Réponse inattendue du serveur IA (HTTP ${res.status}).`, 'invalid');
  }
  if (!res.ok) {
    const e = (data as ApiError).error;
    throw new AiError(e?.message ?? `Erreur du serveur IA (HTTP ${res.status}).`, e?.code ?? 'upstream');
  }
  if (!guard(data)) throw new AiError('Réponse du serveur IA dans un format inattendu.', 'invalid');
  return data;
}

/**
 * Vérifie l'adresse et le code sans appeler Claude (donc sans coût) :
 * une requête vide doit être refusée pour « contexte manquant » (400) et non pour le code (401).
 */
export async function testAiConnection(settings: Settings): Promise<string> {
  try {
    await aiRequest(settings, '/coach', {}, (_v): _v is never => false, 15_000);
    return 'ok';
  } catch (err) {
    if (err instanceof AiError && err.code === 'bad_request') return 'ok';
    throw err;
  }
}
