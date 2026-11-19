import { useId, useState, type FormEvent } from 'react';
import { formatDuration, formatSpeedFor, parseDuration, parseKm, parseOptionalNumber, toIsoDate } from '../domain/format';
import { HYROX_DIVISIONS, hyroxTemplate, segmentsTotal } from '../domain/hyrox';
import { SPORTS, SPORT_IDS, type SportId } from '../domain/sports';
import {
  RUN_TYPES,
  RUN_TYPE_LABELS,
  WOD_FORMATS,
  WOD_FORMAT_LABELS,
  WOD_LEVELS,
  WOD_LEVEL_LABELS,
  type Activity,
  type ActivityInput,
  type Lift,
  type PlannedSession,
  type RunType,
  type Segment,
  type WodFormat,
  type WodLevel,
} from '../domain/types';
import { validateActivity, type Errors } from '../domain/validation';
import { FieldError, RPE_LABELS, Scale } from './ui';

/** Valeurs pré-remplies (venant d'un chrono, par exemple). */
export interface ActivityPrefill {
  title?: string;
  durationSeconds?: number;
  format?: WodFormat;
  score?: string;
}

interface Props {
  sport: SportId;
  initial?: Activity;
  plan?: PlannedSession;
  prefill?: ActivityPrefill;
  onSubmit(input: ActivityInput): void;
  onCancel(): void;
}

/** WOD de référence CrossFit (« The Girls », « Heroes ») proposés à la saisie. */
const BENCHMARKS = ['Fran', 'Grace', 'Helen', 'Diane', 'Elizabeth', 'Isabel', 'Karen', 'Annie', 'Cindy', 'Mary', 'Jackie', 'Nancy', 'Chelsea', 'Angie', 'Barbara', 'Kelly', 'Murph', 'DT', 'Fight Gone Bad'];
const LIFTS = ['Back Squat', 'Front Squat', 'Deadlift', 'Clean', 'Clean & Jerk', 'Snatch', 'Strict Press', 'Push Press', 'Bench Press', 'Overhead Squat', 'Thruster'];

const secToInput = (s?: number) => (s ? formatDuration(s) : '');
const numToInput = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','));

export function ActivityForm({ sport: initialSport, initial, plan, prefill, onSubmit, onCancel }: Props) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const today = toIsoDate(new Date());

  const [sport, setSport] = useState<SportId>(initial?.sport ?? initialSport);
  const info = SPORTS[sport];
  const [date, setDate] = useState(initial?.date ?? (plan && plan.date <= today ? plan.date : today));
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [title, setTitle] = useState(initial?.title ?? plan?.title ?? prefill?.title ?? '');
  const [duration, setDuration] = useState(
    secToInput(initial?.durationSeconds ?? prefill?.durationSeconds) || (plan?.targetDurationMin ? formatDuration(plan.targetDurationMin * 60) : ''),
  );
  const [rpe, setRpe] = useState(initial?.rpe);
  const [hrAvg, setHrAvg] = useState(numToInput(initial?.heartRateAvg));
  const [hrMax, setHrMax] = useState(numToInput(initial?.heartRateMax));
  const [calories, setCalories] = useState(numToInput(initial?.calories));
  const [notes, setNotes] = useState(initial?.notes ?? plan?.description ?? '');
  // Endurance
  const [distance, setDistance] = useState(initial?.distanceMeters ? numToInput(initial.distanceMeters / 1000) : plan?.targetDistanceKm ? numToInput(plan.targetDistanceKm) : '');
  const [elevation, setElevation] = useState(numToInput(initial?.elevationGain));
  const [runType, setRunType] = useState<RunType | ''>(initial?.runType ?? '');
  // CrossFit
  const [format, setFormat] = useState<WodFormat>(initial?.crossfit?.format ?? prefill?.format ?? 'for-time');
  const [level, setLevel] = useState<WodLevel>(initial?.crossfit?.level ?? 'rx');
  const [wodName, setWodName] = useState(initial?.crossfit?.wodName ?? '');
  const [workout, setWorkout] = useState(initial?.crossfit?.workout ?? '');
  const [score, setScore] = useState(initial?.crossfit?.score ?? prefill?.score ?? '');
  const [lifts, setLifts] = useState<{ exercise: string; sets: string; reps: string; weight: string }[]>(
    (initial?.crossfit?.lifts ?? []).map((l) => ({ exercise: l.exercise, sets: String(l.sets), reps: String(l.reps), weight: numToInput(l.weightKg) })),
  );
  // HYROX / ATH X
  const [official, setOfficial] = useState(initial?.race?.official ?? false);
  const [division, setDivision] = useState(initial?.race?.division ?? '');
  const [rank, setRank] = useState(numToInput(initial?.race?.rank));
  const [segments, setSegments] = useState<{ name: string; kind: Segment['kind']; time: string }[]>(() => {
    const src = initial?.race?.segments ?? (initialSport === 'hyrox' && !initial ? hyroxTemplate() : []);
    return src.map((s) => ({ name: s.name, kind: s.kind, time: secToInput(s.seconds) }));
  });
  const [errors, setErrors] = useState<Errors<ActivityInput>>({});

  const parsedSegments: Segment[] = segments.map((s) => ({ name: s.name, kind: s.kind, seconds: s.time.trim() ? (parseDuration(s.time) ?? Number.NaN) : undefined }));
  const segTotal = segmentsTotal(parsedSegments.filter((s) => Number.isFinite(s.seconds)));
  const distanceMeters = parseKm(distance);
  const durationSeconds = parseDuration(duration) ?? (info.category === 'race' && segTotal > 0 ? segTotal : null);

  function changeSport(next: SportId) {
    setSport(next);
    if (next === 'hyrox' && segments.length === 0) setSegments(hyroxTemplate().map((s) => ({ name: s.name, kind: s.kind, time: '' })));
  }

  function build(): ActivityInput {
    const base: ActivityInput = {
      sport,
      date,
      startTime: startTime || undefined,
      title,
      durationSeconds: durationSeconds ?? Number.NaN,
      rpe,
      heartRateAvg: parseOptionalNumber(hrAvg),
      heartRateMax: parseOptionalNumber(hrMax),
      calories: parseOptionalNumber(calories),
      notes,
      planId: initial?.planId ?? plan?.id,
      source: initial?.source ?? 'manual',
      // Conserver les données GPS lors d'une modification.
      splits: initial?.splits,
      hasTrack: initial?.hasTrack,
    };
    if (info.category === 'endurance') {
      return { ...base, distanceMeters: distance.trim() ? (distanceMeters ?? Number.NaN) : undefined, elevationGain: parseOptionalNumber(elevation), runType: sport === 'course' && runType ? runType : undefined };
    }
    if (info.category === 'crossfit') {
      const parsedLifts: Lift[] = lifts
        .filter((l) => l.exercise.trim() || l.sets || l.reps || l.weight)
        .map((l) => ({ exercise: l.exercise, sets: Number(l.sets) || 0, reps: Number(l.reps) || 0, weightKg: parseOptionalNumber(l.weight) }));
      return { ...base, crossfit: { format, level, wodName, workout, score, lifts: parsedLifts } };
    }
    return {
      ...base,
      race: { official, division: division || undefined, rank: parseOptionalNumber(rank), segments: parsedSegments.filter((s) => s.name.trim() || s.seconds !== undefined) },
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input = build();
    const found = validateActivity(input, today);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(input);
    else document.querySelector('[aria-invalid="true"], .field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  const updateLift = (i: number, patch: Partial<(typeof lifts)[number]>) => setLifts(lifts.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const updateSeg = (i: number, patch: Partial<(typeof segments)[number]>) => setSegments(segments.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate aria-label={initial ? "Modifier l'activité" : 'Nouvelle activité'}>
      <section className="card form">
        <div className="card-head">
          <h2>
            {info.icon} {initial ? 'Modifier' : 'Nouvelle séance'}
          </h2>
          {plan && <span className="badge">Séance planifiée</span>}
        </div>
        <label htmlFor={id('sport')}>
          Sport
          <select id={id('sport')} value={sport} onChange={(e) => changeSport(e.target.value as SportId)}>
            {SPORT_IDS.map((s) => (
              <option key={s} value={s}>
                {SPORTS[s].icon} {SPORTS[s].label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid-2">
          <label htmlFor={id('date')}>
            Date
            <input id={id('date')} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
            <FieldError message={errors.date} />
          </label>
          <label htmlFor={id('time')}>
            Heure
            <input id={id('time')} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
        </div>
        <label htmlFor={id('title')}>
          Titre
          <input id={id('title')} placeholder={info.category === 'crossfit' ? 'WOD du jour' : 'Optionnel'} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid-2">
          <label htmlFor={id('duration')}>
            Durée
            <input
              id={id('duration')}
              inputMode="numeric"
              placeholder={info.category === 'race' && segTotal ? formatDuration(segTotal) : '45:30 ou 1:05:00'}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              aria-invalid={!!errors.durationSeconds}
            />
            <FieldError message={errors.durationSeconds} />
          </label>
          {info.category === 'endurance' && (
            <label htmlFor={id('distance')}>
              Distance (km)
              <input id={id('distance')} inputMode="decimal" placeholder="10,5" value={distance} onChange={(e) => setDistance(e.target.value)} aria-invalid={!!errors.distanceMeters} />
              <FieldError message={errors.distanceMeters} />
            </label>
          )}
        </div>
        {info.category === 'endurance' && (
          <p className="pace-preview" aria-live="polite">
            {distanceMeters && durationSeconds ? (
              <>
                {info.paceUnit === 'km/h' ? 'Vitesse' : 'Allure'} <strong>{formatSpeedFor(info.paceUnit, distanceMeters, durationSeconds)}</strong>
              </>
            ) : (
              'Saisis la distance et la durée pour calculer ton allure.'
            )}
          </p>
        )}
        <fieldset>
          <legend>Effort perçu (RPE)</legend>
          <Scale name="Effort perçu" value={rpe} max={10} onChange={setRpe} labels={RPE_LABELS} />
          <FieldError message={errors.rpe} />
          <p className="muted small hint">Sert à calculer ta charge d'entraînement, tous sports confondus.</p>
        </fieldset>
      </section>

      {info.category === 'endurance' && (
        <section className="card form">
          <h2>Détails</h2>
          <div className="grid-2">
            {sport === 'course' && (
              <label htmlFor={id('runType')}>
                Type de sortie
                <select id={id('runType')} value={runType} onChange={(e) => setRunType(e.target.value as RunType | '')}>
                  <option value="">—</option>
                  {RUN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {RUN_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label htmlFor={id('elev')}>
              Dénivelé + (m)
              <input id={id('elev')} inputMode="numeric" placeholder="Optionnel" value={elevation} onChange={(e) => setElevation(e.target.value)} aria-invalid={!!errors.elevationGain} />
              <FieldError message={errors.elevationGain} />
            </label>
          </div>
        </section>
      )}

      {info.category === 'crossfit' && (
        <section className="card form">
          <h2>WOD</h2>
          <div className="grid-2">
            <label htmlFor={id('format')}>
              Format
              <select id={id('format')} value={format} onChange={(e) => setFormat(e.target.value as WodFormat)}>
                {WOD_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {WOD_FORMAT_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={id('level')}>
              Niveau
              <select id={id('level')} value={level} onChange={(e) => setLevel(e.target.value as WodLevel)}>
                {WOD_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {WOD_LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={id('wod')}>
              Nom du WOD (benchmark)
              <input id={id('wod')} list={id('benchmarks')} placeholder="Fran, Murph…" value={wodName} onChange={(e) => setWodName(e.target.value)} />
              <datalist id={id('benchmarks')}>
                {BENCHMARKS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </label>
            <label htmlFor={id('score')}>
              Score
              <input
                id={id('score')}
                placeholder={format === 'for-time' ? 'Temps : 4:32' : format === 'amrap' ? 'Tours+reps : 5+12' : format === 'force' ? 'Charge : 100 kg' : 'Libre'}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </label>
          </div>
          <label htmlFor={id('workout')}>
            Contenu de la séance
            <textarea id={id('workout')} rows={4} placeholder={'21-15-9\nThrusters 43 kg\nPull-ups'} value={workout} onChange={(e) => setWorkout(e.target.value)} />
          </label>

          <h3 className="sub">Force / haltérophilie</h3>
          <datalist id={id('lifts')}>
            {LIFTS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
          {lifts.map((l, i) => (
            <div key={i} className="lift-row">
              <input aria-label={`Exercice ${i + 1}`} list={id('lifts')} placeholder="Exercice" value={l.exercise} onChange={(e) => updateLift(i, { exercise: e.target.value })} />
              <input aria-label={`Séries ${i + 1}`} inputMode="numeric" placeholder="Séries" value={l.sets} onChange={(e) => updateLift(i, { sets: e.target.value })} />
              <input aria-label={`Répétitions ${i + 1}`} inputMode="numeric" placeholder="Reps" value={l.reps} onChange={(e) => updateLift(i, { reps: e.target.value })} />
              <input aria-label={`Charge ${i + 1}`} inputMode="decimal" placeholder="kg" value={l.weight} onChange={(e) => updateLift(i, { weight: e.target.value })} />
              <button type="button" className="icon-btn" aria-label={`Retirer l'exercice ${i + 1}`} onClick={() => setLifts(lifts.filter((_, k) => k !== i))}>
                ✕
              </button>
              <FieldError message={errors[`lift-${i}`]} />
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setLifts([...lifts, { exercise: '', sets: '', reps: '', weight: '' }])}>
            + Ajouter un exercice
          </button>
        </section>
      )}

      {info.category === 'race' && (
        <section className="card form">
          <h2>{info.label}</h2>
          <div className="segmented" role="group" aria-label="Type">
            <button type="button" className={!official ? 'active' : ''} aria-pressed={!official} onClick={() => setOfficial(false)}>
              Entraînement
            </button>
            <button type="button" className={official ? 'active' : ''} aria-pressed={official} onClick={() => setOfficial(true)}>
              Course officielle
            </button>
          </div>
          <div className="grid-2">
            <label htmlFor={id('division')}>
              Division
              <input id={id('division')} list={id('divisions')} placeholder={sport === 'hyrox' ? 'Open, Pro…' : 'Optionnel'} value={division} onChange={(e) => setDivision(e.target.value)} />
              {sport === 'hyrox' && (
                <datalist id={id('divisions')}>
                  {HYROX_DIVISIONS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              )}
            </label>
            {official && (
              <label htmlFor={id('rank')}>
                Classement
                <input id={id('rank')} inputMode="numeric" placeholder="Optionnel" value={rank} onChange={(e) => setRank(e.target.value)} />
                <FieldError message={errors.race} />
              </label>
            )}
          </div>

          <h3 className="sub">Temps par segment</h3>
          <p className="muted small hint">
            {sport === 'athx' ? 'Ajoute les zones ou épreuves de ton ATH X et leurs temps.' : 'Remplis les temps que tu as (mm:ss). '}
            Si la durée totale est vide, la somme des segments est utilisée{segTotal ? ` (${formatDuration(segTotal)})` : ''}.
          </p>
          <ol className="segments">
            {segments.map((s, i) => (
              <li key={i} className={`segment-row kind-${s.kind}`}>
                <input aria-label={`Segment ${i + 1}`} value={s.name} onChange={(e) => updateSeg(i, { name: e.target.value })} />
                <input aria-label={`Temps ${s.name || i + 1}`} inputMode="numeric" placeholder="mm:ss" value={s.time} onChange={(e) => updateSeg(i, { time: e.target.value })} aria-invalid={!!errors[`segment-${i}`]} />
                <button type="button" className="icon-btn" aria-label={`Retirer ${s.name || 'le segment'}`} onClick={() => setSegments(segments.filter((_, k) => k !== i))}>
                  ✕
                </button>
                <FieldError message={errors[`segment-${i}`]} />
              </li>
            ))}
          </ol>
          <div className="button-row">
            <button type="button" className="btn ghost small" onClick={() => setSegments([...segments, { name: '', kind: 'other', time: '' }])}>
              + Ajouter un segment
            </button>
            {sport === 'hyrox' && (
              <button type="button" className="btn ghost small" onClick={() => setSegments(hyroxTemplate().map((s) => ({ name: s.name, kind: s.kind, time: '' })))}>
                Modèle HYROX
              </button>
            )}
          </div>
        </section>
      )}

      <section className="card form">
        <h2>Cardio et notes</h2>
        <div className="grid-3">
          <label htmlFor={id('hr')}>
            FC moy.
            <input id={id('hr')} inputMode="numeric" placeholder="bpm" value={hrAvg} onChange={(e) => setHrAvg(e.target.value)} aria-invalid={!!errors.heartRateAvg} />
            <FieldError message={errors.heartRateAvg} />
          </label>
          <label htmlFor={id('hrmax')}>
            FC max
            <input id={id('hrmax')} inputMode="numeric" placeholder="bpm" value={hrMax} onChange={(e) => setHrMax(e.target.value)} aria-invalid={!!errors.heartRateMax} />
            <FieldError message={errors.heartRateMax} />
          </label>
          <label htmlFor={id('kcal')}>
            Calories
            <input id={id('kcal')} inputMode="numeric" placeholder="kcal" value={calories} onChange={(e) => setCalories(e.target.value)} aria-invalid={!!errors.calories} />
            <FieldError message={errors.calories} />
          </label>
        </div>
        <label htmlFor={id('notes')}>
          Notes
          <textarea id={id('notes')} rows={3} placeholder="Sensations, météo, matériel…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </section>

      <div className="actions sticky-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn primary">
          {initial ? 'Enregistrer' : 'Ajouter la séance'}
        </button>
      </div>
    </form>
  );
}
