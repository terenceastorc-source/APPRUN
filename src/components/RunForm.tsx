import { useId, useState, type FormEvent } from 'react';
import { formatDuration, formatPace, paceSecondsPerKm, parseDuration, parseKm, speedKmh, toIsoDate } from '../domain/format';
import { RUN_TYPES, RUN_TYPE_LABELS, type Run, type RunInput, type RunType } from '../domain/types';
import { validateRun, type ValidationErrors } from '../domain/validation';

interface Props {
  initial?: Run;
  onSubmit(input: RunInput): void;
  onCancel?(): void;
}

const EFFORT_LABELS = ['Très facile', 'Facile', 'Modéré', 'Difficile', 'Épuisant'];

function optionalNumber(value: string): number | undefined {
  const t = value.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function RunForm({ initial, onSubmit, onCancel }: Props) {
  const uid = useId();
  const today = toIsoDate(new Date());
  const [date, setDate] = useState(initial?.date ?? today);
  const [distance, setDistance] = useState(initial ? String(initial.distanceMeters / 1000).replace('.', ',') : '');
  const [duration, setDuration] = useState(initial ? formatDuration(initial.durationSeconds) : '');
  const [type, setType] = useState<RunType>(initial?.type ?? 'footing');
  const [effort, setEffort] = useState<number | undefined>(initial?.effort);
  const [heartRate, setHeartRate] = useState(initial?.heartRateAvg?.toString() ?? '');
  const [elevation, setElevation] = useState(initial?.elevationGain?.toString() ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});

  const distanceMeters = parseKm(distance);
  const durationSeconds = parseDuration(duration);
  const preview = distanceMeters && durationSeconds ? { pace: paceSecondsPerKm(distanceMeters, durationSeconds), speed: speedKmh(distanceMeters, durationSeconds) } : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input: RunInput = {
      date,
      distanceMeters: distanceMeters ?? Number.NaN,
      durationSeconds: durationSeconds ?? Number.NaN,
      type,
      effort,
      heartRateAvg: optionalNumber(heartRate),
      elevationGain: optionalNumber(elevation),
      notes,
    };
    const found = validateRun(input, today);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(input);
  }

  const field = (name: string) => `${uid}-${name}`;
  const err = (key: keyof ValidationErrors) =>
    errors[key] ? (
      <p className="field-error" id={field(`${key}-err`)} role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate aria-label={initial ? 'Modifier la course' : 'Nouvelle course'}>
      <h2>{initial ? 'Modifier la sortie' : 'Nouvelle sortie'}</h2>

      <div className="grid-2">
        <label htmlFor={field('date')}>
          Date
          <input id={field('date')} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
          {err('date')}
        </label>
        <label htmlFor={field('type')}>
          Type
          <select id={field('type')} value={type} onChange={(e) => setType(e.target.value as RunType)}>
            {RUN_TYPES.map((t) => (
              <option key={t} value={t}>
                {RUN_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={field('distance')}>
          Distance (km)
          <input id={field('distance')} inputMode="decimal" placeholder="10,5" value={distance} onChange={(e) => setDistance(e.target.value)} aria-invalid={!!errors.distanceMeters} />
          {err('distanceMeters')}
        </label>
        <label htmlFor={field('duration')}>
          Durée
          <input id={field('duration')} inputMode="numeric" placeholder="52:30 ou 1:05:00" value={duration} onChange={(e) => setDuration(e.target.value)} aria-invalid={!!errors.durationSeconds} />
          {err('durationSeconds')}
        </label>
      </div>

      <p className="pace-preview" aria-live="polite">
        {preview ? (
          <>
            Allure <strong>{formatPace(preview.pace)}</strong> · Vitesse <strong>{preview.speed.toFixed(1).replace('.', ',')} km/h</strong>
          </>
        ) : (
          'Saisis la distance et la durée pour calculer ton allure.'
        )}
      </p>

      <fieldset className="effort">
        <legend>Ressenti</legend>
        <div className="effort-scale">
          {EFFORT_LABELS.map((label, i) => (
            <button
              type="button"
              key={label}
              className={effort === i + 1 ? 'chip active' : 'chip'}
              aria-pressed={effort === i + 1}
              title={label}
              onClick={() => setEffort(effort === i + 1 ? undefined : i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <span className="muted">{effort ? EFFORT_LABELS[effort - 1] : 'Optionnel'}</span>
        </div>
      </fieldset>

      <div className="grid-2">
        <label htmlFor={field('hr')}>
          FC moyenne (bpm)
          <input id={field('hr')} inputMode="numeric" placeholder="Optionnel" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} aria-invalid={!!errors.heartRateAvg} />
          {err('heartRateAvg')}
        </label>
        <label htmlFor={field('elev')}>
          Dénivelé positif (m)
          <input id={field('elev')} inputMode="numeric" placeholder="Optionnel" value={elevation} onChange={(e) => setElevation(e.target.value)} aria-invalid={!!errors.elevationGain} />
          {err('elevationGain')}
        </label>
      </div>

      <label htmlFor={field('notes')}>
        Notes
        <textarea id={field('notes')} rows={3} placeholder="Parcours, météo, sensations…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="actions">
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Annuler
          </button>
        )}
        <button type="submit" className="btn primary">
          {initial ? 'Enregistrer' : 'Ajouter la sortie'}
        </button>
      </div>
    </form>
  );
}
