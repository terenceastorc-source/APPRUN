import { useId, useMemo, useState, type FormEvent } from 'react';
import { addDays, formatDate, formatHours, parseOptionalNumber, startOfWeek, toIsoDate } from '../domain/format';
import { goalProgress, METRIC_LABELS, METRIC_UNITS, PERIOD_LABELS, scopeLabel } from '../domain/goals';
import { CATEGORIES, CATEGORY_LABELS, SPORTS, SPORT_IDS, type SportId } from '../domain/sports';
import type { Activity, Goal, GoalMetric, GoalPeriod, GoalScope, PlannedSession } from '../domain/types';
import { validatePlan, type Errors } from '../domain/validation';
import { navigate } from '../hooks/useRoute';
import type { Store } from '../hooks/useStore';
import { ProgressBar } from './charts';
import { Card, Empty, FieldError } from './ui';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

interface Props {
  store: Store;
  today?: Date;
}

export function PlanView({ store, today = new Date() }: Props) {
  const todayIso = toIsoDate(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(todayIso);
  const [editing, setEditing] = useState<PlannedSession | 'new' | null>(null);
  const { activities, data } = store;

  const byDate = useMemo(() => {
    const map = new Map<string, { acts: Activity[]; plans: PlannedSession[] }>();
    const get = (d: string) => map.get(d) ?? map.set(d, { acts: [], plans: [] }).get(d)!;
    for (const a of activities) get(a.date).acts.push(a);
    for (const p of data.plans) get(p.date).plans.push(p);
    return map;
  }, [activities, data.plans]);

  // Grille du mois, du lundi précédant le 1er au dimanche suivant la fin du mois.
  const gridStart = startOfWeek(month);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let d = gridStart; d <= monthEnd || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);

  const day = byDate.get(selected) ?? { acts: [], plans: [] };

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <button className="icon-btn" aria-label="Mois précédent" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            ‹
          </button>
          <h2 className="capitalize">{monthFormatter.format(month)}</h2>
          <button className="icon-btn" aria-label="Mois suivant" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            ›
          </button>
        </div>
        <div className="calendar" role="grid" aria-label="Calendrier">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-head" role="columnheader">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const iso = toIsoDate(d);
            const entry = byDate.get(iso);
            const inMonth = d.getMonth() === month.getMonth();
            const pending = entry?.plans.filter((p) => !p.activityId) ?? [];
            return (
              <button
                key={iso}
                role="gridcell"
                className={['cal-day', inMonth ? '' : 'out', iso === todayIso ? 'today' : '', iso === selected ? 'selected' : ''].join(' ')}
                aria-label={`${formatDate(iso)} : ${entry?.acts.length ?? 0} séance(s), ${pending.length} prévue(s)`}
                aria-selected={iso === selected}
                onClick={() => setSelected(iso)}
              >
                <span className="cal-num">{d.getDate()}</span>
                <span className="cal-dots">
                  {entry?.acts.slice(0, 3).map((a) => (
                    <span key={a.id} className={`dot-cat cat-${SPORTS[a.sport].category}`} />
                  ))}
                  {pending.slice(0, 2).map((p) => (
                    <span key={p.id} className={`dot-plan${iso < todayIso ? ' missed' : ''}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <p className="muted small legend-line">
          <span className="dot-cat cat-endurance" /> Endurance <span className="dot-cat cat-crossfit" /> CrossFit <span className="dot-cat cat-race" /> HYROX/ATH X <span className="dot-plan" /> Prévu
        </p>
      </section>

      <Card
        title={<span className="capitalize">{formatDate(selected)}</span>}
        action={
          <button className="btn small primary" onClick={() => setEditing('new')}>
            + Planifier
          </button>
        }
      >
        {day.acts.length === 0 && day.plans.length === 0 && <Empty>Rien ce jour-là.</Empty>}
        <ul className="plan-list">
          {day.plans.map((p) => (
            <li key={p.id} className={p.activityId ? 'done' : p.date < todayIso ? 'overdue' : ''}>
              <span aria-hidden="true">{SPORTS[p.sport].icon}</span>
              <span className="grow">
                <strong>{p.title}</strong>
                <span className="muted small">
                  {' '}
                  · {p.activityId ? 'réalisée ✓' : p.date < todayIso ? 'non réalisée' : 'prévue'}
                  {p.targetDurationMin ? ` · ${formatHours(p.targetDurationMin * 60)}` : ''}
                  {p.targetDistanceKm ? ` · ${p.targetDistanceKm} km` : ''}
                </span>
                {p.description && <span className="small notes">{p.description}</span>}
              </span>
              {!p.activityId && p.date <= todayIso && (
                <button className="btn small primary" onClick={() => navigate(`/ajouter/${p.sport}?plan=${p.id}`)}>
                  Fait ✓
                </button>
              )}
              <button className="btn small ghost" onClick={() => setEditing(p)}>
                Modifier
              </button>
            </li>
          ))}
          {day.acts
            .filter((a) => !day.plans.some((p) => p.activityId === a.id))
            .map((a) => (
              <li key={a.id} className="done">
                <span aria-hidden="true">{SPORTS[a.sport].icon}</span>
                <span className="grow">
                  <strong>{a.title ?? SPORTS[a.sport].label}</strong>
                  <span className="muted small"> · {formatHours(a.durationSeconds)}</span>
                </span>
                <button className="btn small ghost" onClick={() => navigate(`/activite/${a.id}`)}>
                  Voir
                </button>
              </li>
            ))}
        </ul>
        {editing && (
          <PlanForm
            key={editing === 'new' ? `new-${selected}` : editing.id}
            initial={editing === 'new' ? undefined : editing}
            date={selected}
            onCancel={() => setEditing(null)}
            onDelete={
              editing !== 'new'
                ? () => {
                    store.removePlan(editing.id);
                    setEditing(null);
                  }
                : undefined
            }
            onSubmit={(p) => {
              if (editing === 'new') store.addPlan(p);
              else store.updatePlan(editing.id, { ...p, activityId: editing.activityId });
              setSelected(p.date);
              setEditing(null);
            }}
          />
        )}
      </Card>

      <GoalsCard store={store} today={today} />
    </div>
  );
}

function PlanForm({ initial, date, onSubmit, onCancel, onDelete }: { initial?: PlannedSession; date: string; onSubmit(p: Omit<PlannedSession, 'id'>): void; onCancel(): void; onDelete?(): void }) {
  const uid = useId();
  const [sport, setSport] = useState<SportId>(initial?.sport ?? 'course');
  const [d, setD] = useState(initial?.date ?? date);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [duration, setDuration] = useState(initial?.targetDurationMin?.toString() ?? '');
  const [distance, setDistance] = useState(initial?.targetDistanceKm?.toString().replace('.', ',') ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Errors<PlannedSession>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const plan: Omit<PlannedSession, 'id'> = {
      sport,
      date: d,
      title,
      description,
      targetDurationMin: parseOptionalNumber(duration),
      targetDistanceKm: SPORTS[sport].category === 'endurance' ? parseOptionalNumber(distance) : undefined,
    };
    const found = validatePlan(plan);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(plan);
  }

  return (
    <form className="form sub-form" onSubmit={submit} noValidate aria-label="Séance planifiée">
      <h3 className="sub">{initial ? 'Modifier la séance prévue' : 'Nouvelle séance prévue'}</h3>
      <div className="grid-2">
        <label htmlFor={`${uid}-sport`}>
          Sport
          <select id={`${uid}-sport`} value={sport} onChange={(e) => setSport(e.target.value as SportId)}>
            {SPORT_IDS.map((s) => (
              <option key={s} value={s}>
                {SPORTS[s].icon} {SPORTS[s].label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${uid}-date`}>
          Date
          <input id={`${uid}-date`} type="date" value={d} onChange={(e) => setD(e.target.value)} />
          <FieldError message={errors.date} />
        </label>
      </div>
      <label htmlFor={`${uid}-title`}>
        Titre
        <input id={`${uid}-title`} placeholder="Ex. 6 × 1000 m, WOD Murph, Simulation HYROX" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
        <FieldError message={errors.title} />
      </label>
      <div className="grid-2">
        <label htmlFor={`${uid}-dur`}>
          Durée prévue (min)
          <input id={`${uid}-dur`} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <FieldError message={errors.targetDurationMin} />
        </label>
        {SPORTS[sport].category === 'endurance' && (
          <label htmlFor={`${uid}-dist`}>
            Distance prévue (km)
            <input id={`${uid}-dist`} inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />
            <FieldError message={errors.targetDistanceKm} />
          </label>
        )}
      </div>
      <label htmlFor={`${uid}-desc`}>
        Consignes
        <textarea id={`${uid}-desc`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="actions">
        {onDelete && (
          <button type="button" className="btn danger" onClick={onDelete}>
            Supprimer
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn primary">
          Enregistrer
        </button>
      </div>
    </form>
  );
}

function GoalsCard({ store, today }: { store: Store; today: Date }) {
  const uid = useId();
  const [adding, setAdding] = useState(false);
  const [scope, setScope] = useState<GoalScope>('all');
  const [metric, setMetric] = useState<GoalMetric>('sessions');
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const goals = store.data.goals.map((g) => goalProgress(g, store.activities, today));

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = parseOptionalNumber(target);
    if (t === undefined || !Number.isFinite(t) || t <= 0) {
      setError('Indique une valeur cible positive.');
      return;
    }
    const goal: Omit<Goal, 'id'> = { scope, metric, period, target: t };
    store.addGoal(goal);
    setAdding(false);
    setTarget('');
    setError('');
  }

  return (
    <Card
      title="Objectifs"
      action={
        !adding && (
          <button className="btn small primary" onClick={() => setAdding(true)}>
            + Objectif
          </button>
        )
      }
    >
      {goals.length === 0 && !adding && <Empty>Aucun objectif pour l'instant.</Empty>}
      <ul className="goal-list">
        {goals.map(({ goal, done, ratio, elapsed }) => (
          <li key={goal.id}>
            <div className="row-between">
              <span>
                {METRIC_LABELS[goal.metric]} · {scopeLabel(goal.scope)} <span className="muted small">{PERIOD_LABELS[goal.period]}</span>
              </span>
              <button className="icon-btn" aria-label={`Supprimer l'objectif ${scopeLabel(goal.scope)}`} onClick={() => store.removeGoal(goal.id)}>
                ✕
              </button>
            </div>
            <ProgressBar ratio={ratio} elapsed={elapsed} label={`Objectif ${scopeLabel(goal.scope)}`} />
            <p className="muted small">
              {Math.round(done * 10) / 10} / {goal.target} {METRIC_UNITS[goal.metric]} · {Math.round(ratio * 100)} %{ratio < elapsed && ratio < 1 ? ' · en retard sur le rythme' : ''}
            </p>
          </li>
        ))}
      </ul>
      {adding && (
        <form className="form sub-form" onSubmit={submit} noValidate aria-label="Nouvel objectif">
          <div className="grid-2">
            <label htmlFor={`${uid}-scope`}>
              Pour
              <select id={`${uid}-scope`} value={scope} onChange={(e) => setScope(e.target.value as GoalScope)}>
                <option value="all">Toutes activités</option>
                {CATEGORIES.map((c) => (
                  <optgroup key={c} label={CATEGORY_LABELS[c]}>
                    <option value={c}>Catégorie {CATEGORY_LABELS[c]}</option>
                    {SPORT_IDS.filter((s) => SPORTS[s].category === c).map((s) => (
                      <option key={s} value={s}>
                        {SPORTS[s].label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label htmlFor={`${uid}-metric`}>
              Mesure
              <select id={`${uid}-metric`} value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
                {(Object.keys(METRIC_LABELS) as GoalMetric[]).map((m) => (
                  <option key={m} value={m}>
                    {METRIC_LABELS[m]} ({METRIC_UNITS[m]})
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${uid}-period`}>
              Période
              <select id={`${uid}-period`} value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)}>
                {(Object.keys(PERIOD_LABELS) as GoalPeriod[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${uid}-target`}>
              Cible ({METRIC_UNITS[metric]})
              <input id={`${uid}-target`} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} aria-invalid={!!error} />
              <FieldError message={error} />
            </label>
          </div>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
              Annuler
            </button>
            <button type="submit" className="btn primary">
              Ajouter
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
