import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration, formatKm, formatPace, formatSpeedFor, toIsoDate } from '../domain/format';
import { downsample } from '../domain/geo';
import { addPoint, elapsedMs, initialRecorder, pause, resume, start, summarize, type RecorderState } from '../domain/recorder';
import { SPORTS, type SportId } from '../domain/sports';
import type { ActivityInput } from '../domain/types';
import { trackStore } from '../storage/tracks';
import { RPE_LABELS, Scale } from './ui';

const TrackMap = lazy(() => import('./TrackMap').then((m) => ({ default: m.TrackMap })));
const LIVE_KEY = 'apprun:live';

function loadLive(sport: SportId): RecorderState {
  try {
    const raw = localStorage.getItem(LIVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as RecorderState;
      if (s.status !== 'idle') return s.status === 'running' ? pause(s, Date.now()) : s;
    }
  } catch {
    /* sauvegarde illisible : on repart de zéro */
  }
  return initialRecorder(sport);
}

interface Props {
  sport: SportId;
  onSave(input: ActivityInput): string;
  onDone(activityId: string): void;
  onCancel(): void;
}

export function LiveTracker({ sport, onSave, onDone, onCancel }: Props) {
  const [state, setState] = useState<RecorderState>(() => loadLive(sport));
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState<number>();
  const [notes, setNotes] = useState('');
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const info = SPORTS[state.sport];
  const sum = summarize(state, now);
  const recovered = useRef(state.status === 'paused');

  // Sauvegarde continue : un rechargement de la page ne perd pas la séance.
  useEffect(() => {
    try {
      if (state.status === 'idle') localStorage.removeItem(LIVE_KEY);
      else localStorage.setItem(LIVE_KEY, JSON.stringify(state));
    } catch {
      /* stockage plein ou indisponible */
    }
  }, [state]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    void wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  }, []);

  const startWatching = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setError("Ce navigateur ne donne pas accès au GPS.");
      return;
    }
    try {
      // Garder l'écran allumé : sur mobile, le GPS d'une page web s'arrête écran verrouillé.
      wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      /* non supporté : on continue sans */
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        setAccuracy(pos.coords.accuracy);
        setState((s) =>
          addPoint(s, { lat: pos.coords.latitude, lon: pos.coords.longitude, t: pos.timestamp, alt: pos.coords.altitude ?? undefined, acc: pos.coords.accuracy }),
        );
      },
      (err) =>
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Accès à la position refusé. Autorise la localisation pour ce site dans les réglages du navigateur."
            : 'Signal GPS indisponible. Mets-toi à découvert.',
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, []);

  useEffect(() => stopWatching, [stopWatching]);

  function handleStart() {
    setState((s) => start(s, Date.now()));
    void startWatching();
  }
  function handlePause() {
    setState((s) => pause(s, Date.now()));
    stopWatching();
  }
  function handleResume() {
    recovered.current = false;
    setState((s) => resume(s, Date.now()));
    void startWatching();
  }
  function handleFinish() {
    if (state.status === 'running') handlePause();
    setFinishing(true);
  }
  function discard() {
    if (!confirm('Abandonner cette séance ? La trace sera perdue.')) return;
    stopWatching();
    setState(initialRecorder(sport));
    onCancel();
  }

  async function save() {
    const final = summarize(state, Date.now());
    const segments = state.segments.filter((s) => s.length > 0).map((s) => downsample(s));
    const started = new Date(state.startedAt ?? Date.now());
    const id = onSave({
      sport: state.sport,
      date: toIsoDate(started),
      startTime: `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`,
      durationSeconds: Math.max(final.durationSeconds, 1),
      distanceMeters: final.distanceMeters > 0 ? final.distanceMeters : undefined,
      elevationGain: final.elevationGain || undefined,
      splits: final.splits.length ? final.splits : undefined,
      hasTrack: segments.length > 0,
      rpe,
      notes,
      source: 'gps',
    });
    if (segments.length) await trackStore.save({ activityId: id, segments }).catch(() => undefined);
    setState(initialRecorder(sport));
    onDone(id);
  }

  if (finishing) {
    return (
      <div className="stack">
        <section className="card">
          <h2>{info.icon} Séance terminée</h2>
          <div className="metrics-grid">
            <div className="metric">
              <span className="muted small">Durée</span>
              <strong>{formatDuration(sum.durationSeconds)}</strong>
            </div>
            <div className="metric">
              <span className="muted small">Distance</span>
              <strong>{formatKm(sum.distanceMeters)}</strong>
            </div>
            <div className="metric">
              <span className="muted small">{info.paceUnit === 'km/h' ? 'Vitesse' : 'Allure'}</span>
              <strong>{formatSpeedFor(info.paceUnit, sum.distanceMeters, sum.durationSeconds)}</strong>
            </div>
            {sum.elevationGain > 0 && (
              <div className="metric">
                <span className="muted small">D+</span>
                <strong>{sum.elevationGain} m</strong>
              </div>
            )}
          </div>
        </section>
        <section className="card form">
          <fieldset>
            <legend>Effort perçu (RPE)</legend>
            <Scale name="Effort perçu" value={rpe} max={10} onChange={setRpe} labels={RPE_LABELS} />
          </fieldset>
          <label>
            Notes
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sensations, météo…" />
          </label>
        </section>
        <div className="actions">
          <button className="btn danger" onClick={discard}>
            Abandonner
          </button>
          <button className="btn ghost" onClick={() => setFinishing(false)}>
            Retour
          </button>
          <button className="btn primary" onClick={save}>
            Enregistrer la séance
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack live">
      <section className="card live-panel">
        <p className="muted small center">
          {info.icon} {info.label}
          {state.status === 'running' && accuracy !== null && ` · précision GPS ±${Math.round(accuracy)} m`}
          {state.status === 'paused' && ' · en pause'}
        </p>
        <div className="live-time" aria-live="off">
          {formatDuration(elapsedMs(state, now) / 1000)}
        </div>
        <div className="live-grid">
          <div>
            <span className="muted small">Distance</span>
            <strong>{(sum.distanceMeters / 1000).toFixed(2).replace('.', ',')} km</strong>
          </div>
          <div>
            <span className="muted small">{info.paceUnit === 'km/h' ? 'Vitesse moy.' : 'Allure moy.'}</span>
            <strong>{formatSpeedFor(info.paceUnit, sum.distanceMeters, sum.durationSeconds)}</strong>
          </div>
          <div>
            <span className="muted small">Allure actuelle</span>
            <strong>{sum.currentPace ? formatPace(sum.currentPace) : '–'}</strong>
          </div>
        </div>
      </section>

      {error && (
        <p className="toast error" role="alert">
          {error}
        </p>
      )}
      {recovered.current && (
        <p className="toast ok" role="status">
          Séance en cours récupérée. Appuie sur Reprendre pour continuer.
        </p>
      )}

      <div className="live-actions">
        {state.status === 'idle' && (
          <>
            <button className="btn ghost" onClick={onCancel}>
              Annuler
            </button>
            <button className="btn primary big" onClick={handleStart}>
              ▶ Démarrer
            </button>
          </>
        )}
        {state.status === 'running' && (
          <>
            <button className="btn big" onClick={handlePause}>
              ⏸ Pause
            </button>
            <button className="btn primary big" onClick={handleFinish}>
              ■ Terminer
            </button>
          </>
        )}
        {state.status === 'paused' && (
          <>
            <button className="btn primary big" onClick={handleResume}>
              ▶ Reprendre
            </button>
            <button className="btn big" onClick={handleFinish}>
              ■ Terminer
            </button>
          </>
        )}
      </div>

      {state.status !== 'idle' && (
        <section className="card">
          <Suspense fallback={<div className="map map-placeholder">Chargement de la carte…</div>}>
            <TrackMap segments={state.segments} follow={state.status === 'running'} className="map live-map" />
          </Suspense>
        </section>
      )}

      {sum.splits.length > 0 && (
        <section className="card">
          <h2>Kilomètres</h2>
          <ol className="splits">
            {sum.splits.map((s, i) => (
              <li key={i}>
                <span>Km {i + 1}</span>
                <strong>{formatPace(s)}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}

      {state.status === 'idle' && (
        <p className="muted small center">
          Garde l'application ouverte et l'écran allumé pendant l'enregistrement : sur téléphone, le navigateur coupe le GPS quand l'écran est verrouillé.
        </p>
      )}
    </div>
  );
}
