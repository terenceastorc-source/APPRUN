import { useId, useState, type FormEvent } from 'react';
import { addDays, formatDate, formatNumber, parseLocalDate, parseOptionalNumber, toIsoDate } from '../domain/format';
import type { BodyEntry } from '../domain/types';
import { validateBody, type Errors } from '../domain/validation';
import type { Store } from '../hooks/useStore';
import { LineChart, StackedBarChart } from './charts';
import { Card, Empty, FieldError, FORM_LABELS, Scale } from './ui';

const RANGES = [
  { days: 30, label: '30 j' },
  { days: 90, label: '3 mois' },
  { days: 365, label: '1 an' },
];
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'numeric' });

export function BodyView({ store, today = new Date() }: { store: Store; today?: Date }) {
  const uid = useId();
  const todayIso = toIsoDate(today);
  const entries = store.data.body;
  const existing = (d: string) => entries.find((e) => e.date === d);
  const [date, setDate] = useState(todayIso);
  const init = existing(todayIso);
  const [weight, setWeight] = useState(init?.weightKg?.toString().replace('.', ',') ?? '');
  const [sleep, setSleep] = useState(init?.sleepHours?.toString().replace('.', ',') ?? '');
  const [restingHr, setRestingHr] = useState(init?.restingHr?.toString() ?? '');
  const [form, setForm] = useState(init?.form);
  const [notes, setNotes] = useState(init?.notes ?? '');
  const [errors, setErrors] = useState<Errors<BodyEntry>>({});
  const [saved, setSaved] = useState(false);
  const [range, setRange] = useState(30);

  function loadDate(d: string) {
    setDate(d);
    const e = existing(d);
    setWeight(e?.weightKg?.toString().replace('.', ',') ?? '');
    setSleep(e?.sleepHours?.toString().replace('.', ',') ?? '');
    setRestingHr(e?.restingHr?.toString() ?? '');
    setForm(e?.form);
    setNotes(e?.notes ?? '');
    setSaved(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const entry: BodyEntry = { date, weightKg: parseOptionalNumber(weight), sleepHours: parseOptionalNumber(sleep), restingHr: parseOptionalNumber(restingHr), form, notes };
    const found = validateBody(entry, todayIso);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      store.upsertBody(entry);
      setSaved(true);
    }
  }

  // Une valeur par jour sur la période (null les jours sans mesure).
  const from = toIsoDate(addDays(today, -(range - 1)));
  const dates: string[] = [];
  for (let i = range - 1; i >= 0; i--) dates.push(toIsoDate(addDays(today, -i)));
  const byDate = new Map(entries.filter((e) => e.date >= from).map((e) => [e.date, e]));
  const col = (k: keyof BodyEntry) => dates.map((d) => (byDate.get(d)?.[k] as number | undefined) ?? null);
  const labels = dates.map((d) => shortDate.format(parseLocalDate(d)));
  const titles = dates.map((d) => formatDate(d));
  const weights = entries.filter((e) => e.weightKg !== undefined);
  const lastW = weights[weights.length - 1];
  const firstW = weights.find((e) => e.date >= from);
  const sleepVals = col('sleepHours').filter((v): v is number => v !== null);

  return (
    <div className="stack">
      <Card title="Mesures du jour">
        <form className="form" onSubmit={submit} noValidate aria-label="Mesures">
          <label htmlFor={`${uid}-date`}>
            Date
            <input id={`${uid}-date`} type="date" value={date} max={todayIso} onChange={(e) => loadDate(e.target.value)} />
          </label>
          <div className="grid-3">
            <label htmlFor={`${uid}-w`}>
              Poids (kg)
              <input id={`${uid}-w`} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} aria-invalid={!!errors.weightKg} />
            </label>
            <label htmlFor={`${uid}-s`}>
              Sommeil (h)
              <input id={`${uid}-s`} inputMode="decimal" value={sleep} onChange={(e) => setSleep(e.target.value)} aria-invalid={!!errors.sleepHours} />
            </label>
            <label htmlFor={`${uid}-hr`}>
              FC repos
              <input id={`${uid}-hr`} inputMode="numeric" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} aria-invalid={!!errors.restingHr} />
            </label>
          </div>
          <FieldError message={errors.weightKg ?? errors.sleepHours ?? errors.restingHr ?? errors.date} />
          <fieldset>
            <legend>Forme ressentie</legend>
            <Scale name="Forme" value={form} max={5} onChange={setForm} labels={FORM_LABELS} />
          </fieldset>
          <label htmlFor={`${uid}-n`}>
            Notes
            <input id={`${uid}-n`} placeholder="Courbatures, douleur, stress…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="actions">
            {existing(date) && (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  store.removeBody(date);
                  loadDate(date);
                }}
              >
                Supprimer
              </button>
            )}
            <button type="submit" className="btn primary">
              {existing(date) ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
          {saved && (
            <p className="toast ok" role="status">
              Mesures enregistrées.
            </p>
          )}
        </form>
      </Card>

      <div className="segmented" role="group" aria-label="Période">
        {RANGES.map((r) => (
          <button key={r.days} className={range === r.days ? 'active' : ''} aria-pressed={range === r.days} onClick={() => setRange(r.days)}>
            {r.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card>
          <Empty>Enregistre tes premières mesures pour voir leur évolution.</Empty>
        </Card>
      ) : (
        <>
          <Card title="Poids (kg)" action={lastW && <span className="muted small">{formatNumber(lastW.weightKg!)} kg{firstW && firstW !== lastW ? ` (${lastW.weightKg! - firstW.weightKg! >= 0 ? '+' : ''}${formatNumber(lastW.weightKg! - firstW.weightKg!)} kg)` : ''}</span>}>
            <LineChart ariaLabel="Évolution du poids" labels={labels} titles={titles} zeroBased={false} connectGaps series={[{ key: 'w', label: 'Poids', color: '--series-1', values: col('weightKg') }]} formatValue={(v) => `${formatNumber(v)} kg`} formatAxis={(v) => formatNumber(v)} />
          </Card>
          <Card title="Sommeil" action={sleepVals.length > 0 && <span className="muted small">moy. {formatNumber(sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length)} h</span>}>
            <StackedBarChart
              ariaLabel="Heures de sommeil"
              labels={labels}
              titles={titles}
              series={[{ key: 's', label: 'Sommeil', color: '--series-1', values: col('sleepHours') }]}
              formatValue={(v) => `${formatNumber(v)} h`}
              height={140}
            />
          </Card>
          <Card title="FC au repos (bpm)">
            <LineChart ariaLabel="Fréquence cardiaque au repos" labels={labels} titles={titles} zeroBased={false} connectGaps series={[{ key: 'hr', label: 'FC repos', color: '--series-1', values: col('restingHr') }]} formatValue={(v) => `${Math.round(v)} bpm`} formatAxis={(v) => String(Math.round(v))} />
            <p className="muted small hint">Une FC de repos qui grimpe de plusieurs battements sur quelques jours peut signaler fatigue ou maladie.</p>
          </Card>
          <Card title="Forme ressentie (1–5)">
            <LineChart ariaLabel="Forme ressentie" labels={labels} titles={titles} zeroBased={false} connectGaps domain={[1, 5]} series={[{ key: 'f', label: 'Forme', color: '--series-1', values: col('form') }]} formatValue={(v) => `${formatNumber(v)}/5`} formatAxis={(v) => formatNumber(v)} />
          </Card>
        </>
      )}
    </div>
  );
}
