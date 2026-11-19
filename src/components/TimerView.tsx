import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration, parseDuration } from '../domain/format';
import { SPORTS, SPORT_IDS, type SportId } from '../domain/sports';
import {
  TIMER_DESCRIPTIONS,
  TIMER_LABELS,
  TIMER_MODES,
  TIMER_PRESETS,
  buildPhases,
  clockElapsed,
  clockPause,
  clockResume,
  clockStart,
  timerAt,
  timerTitle,
  validateTimer,
  wodFormatFor,
  workoutSeconds,
  type RunClock,
  type TimerConfig,
  type TimerMode,
} from '../domain/timer';
import { beep, keepScreenOn, unlockAudio, vibrate } from '../lib/feedback';
import { navigate } from '../hooks/useRoute';
import { FieldError } from './ui';

const PHASE_LABELS = { prep: 'Prêt ?', work: 'Effort', rest: 'Récup', done: 'Terminé' } as const;

/** Affichage mm:ss d'une durée en secondes (arrondi à la seconde supérieure pour un compte à rebours). */
function clock(seconds: number, countdown: boolean): string {
  if (!Number.isFinite(seconds)) return '∞';
  return formatDuration(countdown ? Math.ceil(seconds - 1e-6) : Math.floor(seconds));
}

export function TimerView({ mode: initialMode }: { mode?: TimerMode }) {
  const [config, setConfig] = useState<TimerConfig>(TIMER_PRESETS[initialMode ?? 'amrap']);
  const [run, setRun] = useState<RunClock | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [laps, setLaps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const phases = useMemo(() => buildPhases(config), [config]);
  const release = useRef<() => void>(() => undefined);
  const last = useRef({ phaseIndex: -1, second: -1 });

  const elapsed = run ? clockElapsed(run, finishedAt ?? now) : 0;
  const snap = timerAt(config, elapsed, phases);
  const done = finishedAt !== null || snap.phase === 'done';
  const countdown = snap.phase !== 'work' || Number.isFinite(snap.phaseRemaining);
  const display = snap.phase === 'work' && !Number.isFinite(snap.phaseRemaining) ? snap.phaseElapsed : snap.phaseRemaining;

  useEffect(() => {
    if (!run || run.pausedAt !== undefined || done) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [run, done]);

  // Bips : 3-2-1 avant chaque changement de phase, signal long au changement.
  useEffect(() => {
    if (!run || run.pausedAt !== undefined) return;
    const prev = last.current;
    if (snap.phaseIndex !== prev.phaseIndex) {
      if (prev.phaseIndex !== -1 || snap.phase === 'work') {
        if (snap.phase === 'done') {
          beep(880, 900);
          vibrate([400, 100, 400]);
        } else if (snap.phase === 'work') {
          beep(988, 500);
          vibrate(300);
        } else if (snap.phase === 'rest') {
          beep(523, 500);
          vibrate([150, 80, 150]);
        }
      }
      last.current = { phaseIndex: snap.phaseIndex, second: -1 };
      return;
    }
    if (Number.isFinite(snap.phaseRemaining)) {
      const s = Math.ceil(snap.phaseRemaining - 1e-6);
      if (s !== prev.second && s >= 1 && s <= 3) beep(659, 120);
      last.current.second = s;
    }
  }, [snap.phaseIndex, snap.phase, snap.phaseRemaining, run]);

  useEffect(() => {
    if (snap.phase === 'done' && finishedAt === null && run) {
      setFinishedAt(Date.now());
      release.current();
    }
  }, [snap.phase, finishedAt, run]);

  useEffect(() => () => release.current(), []);

  async function start() {
    const err = validateTimer(config);
    setError(err);
    if (err) return;
    unlockAudio();
    last.current = { phaseIndex: -1, second: -1 };
    setLaps([]);
    setFinishedAt(null);
    const t = Date.now();
    setRun(clockStart(t));
    setNow(t);
    release.current = await keepScreenOn();
  }

  function finishNow() {
    if (!run) return;
    setFinishedAt(Date.now());
    beep(880, 700);
    vibrate([300, 100, 300]);
    release.current();
  }

  function reset() {
    release.current();
    setRun(null);
    setFinishedAt(null);
    setLaps([]);
  }

  if (!run) return <TimerSetup config={config} onChange={setConfig} onStart={start} error={error} />;
  if (done) return <TimerResult config={config} workoutElapsed={snap.workoutElapsed} rounds={laps.length} onRestart={reset} />;

  const paused = run.pausedAt !== undefined;
  const canCountRounds = (config.mode === 'for-time' || config.mode === 'amrap') && snap.phase === 'work';

  return (
    <div className={`timer-run phase-${snap.phase}`}>
      <p className="timer-mode">{timerTitle(config)}</p>
      <p className="timer-phase" aria-live="polite">
        {paused ? 'En pause' : PHASE_LABELS[snap.phase]}
        {snap.totalRounds > 1 && snap.round > 0 && ` · tour ${snap.round}/${snap.totalRounds}`}
      </p>
      <div className="timer-clock" role="timer">
        {clock(display, countdown)}
      </div>
      <p className="timer-sub">
        Séance {formatDuration(Math.floor(snap.workoutElapsed))}
        {Number.isFinite(workoutSeconds(config)) && ` / ${formatDuration(workoutSeconds(config))}`}
      </p>
      {canCountRounds && (
        <button className="btn round-btn" onClick={() => setLaps([...laps, snap.workoutElapsed])} aria-label="Ajouter un tour">
          +1 tour <strong>{laps.length}</strong>
        </button>
      )}
      <div className="timer-actions">
        {paused ? (
          <button className="btn primary big" onClick={() => setRun(clockResume(run, Date.now()))}>
            ▶ Reprendre
          </button>
        ) : (
          <button className="btn big" onClick={() => setRun(clockPause(run, Date.now()))}>
            ⏸ Pause
          </button>
        )}
        {config.mode === 'for-time' ? (
          <button className="btn primary big" onClick={finishNow} disabled={snap.phase === 'prep'}>
            ✓ Terminé
          </button>
        ) : (
          <button className="btn big" onClick={finishNow}>
            ■ Arrêter
          </button>
        )}
      </div>
      {laps.length > 0 && (
        <ol className="laps">
          {laps.map((t, i) => (
            <li key={i}>
              Tour {i + 1} <strong>{formatDuration(Math.floor(t - (laps[i - 1] ?? 0)))}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TimerSetup({ config, onChange, onStart, error }: { config: TimerConfig; onChange(c: TimerConfig): void; onStart(): void; error: string | null }) {
  const set = (patch: Partial<TimerConfig>) => onChange({ ...config, ...patch });
  const total = workoutSeconds(config);
  return (
    <div className="stack">
      <div className="mode-tabs" role="tablist" aria-label="Type de chrono">
        {TIMER_MODES.map((m) => (
          <button key={m} role="tab" aria-selected={config.mode === m} className={config.mode === m ? 'active' : ''} onClick={() => onChange(TIMER_PRESETS[m])}>
            {TIMER_LABELS[m]}
          </button>
        ))}
      </div>
      <section className="card form">
        <p className="muted small">{TIMER_DESCRIPTIONS[config.mode]}</p>
        <div className="grid-2">
          {config.mode === 'for-time' && <DurationField label="Time cap (0 = sans limite)" value={config.durationSeconds} onChange={(v) => set({ durationSeconds: v })} allowZero />}
          {config.mode === 'amrap' && <DurationField label="Durée" value={config.durationSeconds} onChange={(v) => set({ durationSeconds: v })} />}
          {(config.mode === 'emom' || config.mode === 'tabata' || config.mode === 'intervals') && (
            <>
              <label>
                Tours
                <input inputMode="numeric" value={config.rounds || ''} onChange={(e) => set({ rounds: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
              </label>
              <DurationField label={config.mode === 'emom' ? 'Chaque' : 'Effort'} value={config.workSeconds} onChange={(v) => set({ workSeconds: v })} />
            </>
          )}
          {(config.mode === 'tabata' || config.mode === 'intervals') && <DurationField label="Récupération" value={config.restSeconds} onChange={(v) => set({ restSeconds: v })} allowZero />}
          <label>
            Compte à rebours
            <select value={config.prepSeconds} onChange={(e) => set({ prepSeconds: Number(e.target.value) })}>
              <option value={0}>Aucun</option>
              <option value={5}>5 s</option>
              <option value={10}>10 s</option>
              <option value={15}>15 s</option>
            </select>
          </label>
        </div>
        <p className="pace-preview">
          {timerTitle(config)} · durée totale <strong>{Number.isFinite(total) ? formatDuration(total) : 'libre'}</strong>
        </p>
        <FieldError message={error ?? undefined} />
      </section>
      <button className="btn primary big" onClick={onStart}>
        ▶ Démarrer
      </button>
      <p className="muted small center">Monte le son : un bip marque 3-2-1 et chaque changement de phase. L'écran reste allumé.</p>
    </div>
  );
}

function DurationField({ label, value, onChange, allowZero = false }: { label: string; value: number; onChange(v: number): void; allowZero?: boolean }) {
  const [text, setText] = useState(value ? formatDuration(value) : allowZero ? '0' : '');
  return (
    <label>
      {label}
      <input
        inputMode="numeric"
        placeholder="mm:ss"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const t = e.target.value.trim();
          if (allowZero && (t === '0' || t === '')) onChange(0);
          else {
            // « 12 » = 12 minutes ; « 0:45 » = 45 secondes.
            const v = parseDuration(t);
            onChange(v ?? 0);
          }
        }}
      />
    </label>
  );
}

function TimerResult({ config, workoutElapsed, rounds, onRestart }: { config: TimerConfig; workoutElapsed: number; rounds: number; onRestart(): void }) {
  const [sport, setSport] = useState<SportId>('crossfit');
  const [extraReps, setExtraReps] = useState('');
  const duration = Math.max(1, Math.round(workoutElapsed));
  const score =
    config.mode === 'for-time' ? formatDuration(duration) : config.mode === 'amrap' ? `${rounds}${extraReps.trim() ? `+${extraReps.trim()}` : ''}` : '';

  function save() {
    const q = new URLSearchParams({ duree: String(duration), titre: timerTitle(config) });
    if (SPORTS[sport].category === 'crossfit') {
      q.set('format', wodFormatFor(config.mode));
      if (score) q.set('score', score);
    }
    navigate(`/ajouter/${sport}?${q.toString()}`);
  }

  return (
    <div className="stack">
      <section className="card center">
        <p className="muted">{timerTitle(config)}</p>
        <div className="timer-clock result">{formatDuration(duration)}</div>
        {config.mode === 'amrap' && (
          <p>
            <strong>{rounds}</strong> tour{rounds > 1 ? 's' : ''} complet{rounds > 1 ? 's' : ''}
          </p>
        )}
      </section>
      <section className="card form">
        {config.mode === 'amrap' && (
          <label>
            Répétitions du tour incomplet
            <input inputMode="numeric" placeholder="0" value={extraReps} onChange={(e) => setExtraReps(e.target.value.replace(/\D/g, ''))} />
          </label>
        )}
        <label>
          Enregistrer comme
          <select value={sport} onChange={(e) => setSport(e.target.value as SportId)}>
            {SPORT_IDS.map((s) => (
              <option key={s} value={s}>
                {SPORTS[s].icon} {SPORTS[s].label}
              </option>
            ))}
          </select>
        </label>
        {score && (
          <p className="pace-preview">
            Score : <strong>{score}</strong>
          </p>
        )}
      </section>
      <div className="actions">
        <button className="btn ghost" onClick={onRestart}>
          Nouveau chrono
        </button>
        <button className="btn primary" onClick={save}>
          Enregistrer la séance
        </button>
      </div>
    </div>
  );
}
