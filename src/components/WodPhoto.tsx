import { useRef, useState } from 'react';
import { AiError, aiConfigured, aiRequest } from '../ai/client';
import { isWodExtraction, type WodExtraction } from '../ai/contract';
import type { Settings } from '../domain/types';
import { photoToJpegBase64 } from '../lib/image';
import { navigate } from '../hooks/useRoute';
import type { ActivityPrefill } from './ActivityForm';

const PREFILL_KEY = 'apprun:prefill';

/** Convertit la lecture de la photo en valeurs pour le formulaire de séance. */
export function prefillFromWod(w: WodExtraction): ActivityPrefill {
  return {
    title: w.title || undefined,
    format: w.format,
    wodName: w.wodName || undefined,
    workout: w.workout || undefined,
    // Durée connue seulement pour un bloc à durée fixe (AMRAP, EMOM, Tabata).
    durationSeconds: ['amrap', 'emom', 'tabata'].includes(w.format) && w.durationMinutes > 0 ? Math.round(w.durationMinutes * 60) : undefined,
    lifts: w.lifts.filter((l) => l.exercise.trim()).map((l) => ({ exercise: l.exercise, sets: l.sets, reps: l.reps, weightKg: l.weightKg > 0 ? l.weightKg : undefined })),
    source: { kind: 'photo', note: w.note, confidence: w.confidence },
  };
}

/** Transmet le pré-remplissage au formulaire (trop volumineux pour l'URL). */
export function storePrefill(p: ActivityPrefill): void {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(p));
  } catch {
    /* stockage indisponible : le formulaire s'ouvrira vide */
  }
}

export function takePrefill(): ActivityPrefill | undefined {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    return raw ? (JSON.parse(raw) as ActivityPrefill) : undefined;
  } catch {
    return undefined;
  }
}

export function WodPhotoButton({ settings, compact = false }: { settings: Settings; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ status: 'idle' | 'loading' } | { status: 'error'; message: string }>({ status: 'idle' });

  if (!aiConfigured(settings)) {
    return compact ? null : (
      <p className="muted small">
        📷 Photo du WOD : configure le coach IA dans les{' '}
        <button className="link" onClick={() => navigate('/reglages')}>
          réglages
        </button>
        .
      </p>
    );
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setState({ status: 'loading' });
    try {
      const { data, mediaType } = await photoToJpegBase64(file);
      const w = await aiRequest(settings, '/wod-photo', { image: data, mediaType }, isWodExtraction);
      if (!w.readable) {
        setState({ status: 'error', message: w.note || "Je n'ai pas trouvé de séance lisible sur cette photo. Reprends-la plus près, bien éclairée." });
        return;
      }
      storePrefill(prefillFromWod(w));
      setState({ status: 'idle' });
      navigate(`/ajouter/crossfit?photo=${Date.now()}`);
    } catch (err) {
      setState({ status: 'error', message: err instanceof AiError ? err.message : 'Impossible de lire cette image.' });
    }
  }

  return (
    <div className="photo-box">
      <button className={compact ? 'btn small' : 'btn primary photo-btn'} disabled={state.status === 'loading'} onClick={() => input.current?.click()}>
        {state.status === 'loading' ? '⏳ Lecture du tableau…' : '📷 Photo du WOD'}
      </button>
      {!compact && state.status !== 'loading' && <span className="muted small">Prends le tableau en photo : la séance se remplit toute seule.</span>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="wod-photo-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void onFile(f);
        }}
      />
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
