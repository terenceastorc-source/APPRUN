import { addDays, formatDate, formatDuration, formatHours, formatKm, formatNumber, formatPace, paceSecondsPerKm, parseLocalDate, toIsoDate } from '../domain/format';
import { goalProgress, METRIC_UNITS, PERIOD_LABELS, scopeLabel } from '../domain/goals';
import { LOAD_STATUS_LABELS, loadHistory, loadState } from '../domain/load';
import { benchmarkRecords, enduranceHighlights, liftRecords, raceRecords, runRecords } from '../domain/records';
import { CATEGORIES, CATEGORY_LABELS, SPORTS } from '../domain/sports';
import { bySport, inPeriod, totals, weekStreak, weeklyByCategory } from '../domain/stats';
import type { AppData, Activity } from '../domain/types';
import { navigate } from '../hooks/useRoute';
import { ActivityCard } from './ActivityCard';
import { LineChart, ProgressBar, StackedBarChart } from './charts';
import { Card, Empty } from './ui';

const CATEGORY_COLORS = { endurance: '--series-1', crossfit: '--series-2', race: '--series-3' } as const;
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'numeric' });
const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

interface Props {
  data: AppData;
  activities: Activity[];
  today?: Date;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <span className="stat-title">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Dashboard({ data, activities, today = new Date() }: Props) {
  if (activities.length === 0 && data.plans.length === 0) {
    return (
      <section className="card empty">
        <h2>Bienvenue sur APPRUN 💪</h2>
        <p>Course, vélo, natation, CrossFit, HYROX, ATH X : enregistre tes séances pour suivre ta charge, tes objectifs et tes records.</p>
        <div className="button-row center">
          <button className="btn primary" onClick={() => navigate('/ajouter')}>
            Ajouter une séance
          </button>
          <button className="btn" onClick={() => navigate('/plan')}>
            Planifier ma semaine
          </button>
        </div>
      </section>
    );
  }

  const week = totals(inPeriod(activities, 'week', today));
  const lastWeek = totals(inPeriod(activities, 'week', addDays(today, -7)));
  const streak = weekStreak(activities, today);
  const load = loadState(activities, today);
  const history = loadHistory(activities, 12, today);
  const weeks = weeklyByCategory(activities, 12, today);
  const shares = bySport(activities.filter((a) => a.date > toIsoDate(addDays(today, -30))));
  const maxShare = Math.max(...shares.map((s) => s.durationSeconds), 1);
  const goals = data.goals.map((g) => goalProgress(g, activities, today));
  const todayIso = toIsoDate(today);
  const upcoming = data.plans
    .filter((p) => !p.activityId && p.date >= toIsoDate(addDays(today, -3)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const lastBody = [...data.body].reverse().find((b) => b.form || b.sleepHours);
  const runs = runRecords(activities);
  const races = raceRecords(activities);
  const wods = benchmarkRecords(activities);
  const lifts = liftRecords(activities);
  const runHL = enduranceHighlights(activities);
  const delta = week.durationSeconds - lastWeek.durationSeconds;

  return (
    <div className="stack">
      <section aria-label="Cette semaine">
        <h2 className="section-title">Cette semaine</h2>
        <div className="stats-grid">
          <Stat label="Séances" value={String(week.count)} sub={streak > 1 ? `${streak} semaines d'affilée 🔥` : undefined} />
          <Stat label="Temps" value={formatHours(week.durationSeconds)} sub={lastWeek.count ? `${delta >= 0 ? '+' : '−'}${formatHours(Math.abs(delta))} vs sem. passée` : undefined} />
          <Stat label="Distance" value={formatKm(week.distanceMeters)} />
          <Stat label="Charge" value={`${week.load} pts`} />
        </div>
      </section>

      <Card title="Forme et charge" action={<span className={`status status-${load.status}`}>{LOAD_STATUS_LABELS[load.status]}</span>}>
        <p className="muted small">
          Charge 7 jours <b>{load.acute}</b> · moyenne 4 semaines <b>{Math.round(load.chronic)}</b>
          {load.ratio !== null && (
            <>
              {' '}
              · ratio <b>{load.ratio.toFixed(2).replace('.', ',')}</b> (zone idéale 0,8 – 1,3)
            </>
          )}
          {lastBody && (
            <>
              <br />
              Dernière mesure ({formatDate(lastBody.date)}) : {lastBody.form ? `forme ${lastBody.form}/5` : ''}
              {lastBody.form && lastBody.sleepHours ? ', ' : ''}
              {lastBody.sleepHours ? `${formatNumber(lastBody.sleepHours)}\u00a0h de sommeil` : ''}
            </>
          )}
        </p>
        <LineChart
          ariaLabel="Charge aiguë et chronique sur 12 semaines"
          labels={history.map((h) => shortDate.format(parseLocalDate(h.date)))}
          titles={history.map((h) => `7 jours au ${longDate.format(parseLocalDate(h.date))}`)}
          series={[
            { key: 'acute', label: 'Charge 7 jours', color: '--series-1', values: history.map((h) => h.acute) },
            { key: 'chronic', label: 'Moyenne 4 semaines', color: '--series-2', values: history.map((h) => h.chronic) },
          ]}
          formatValue={(v) => formatNumber(Math.round(v))}
        />
        {activities.some((a) => !a.rpe) && <p className="muted small hint">Les séances sans effort perçu (RPE) ne comptent pas dans la charge.</p>}
      </Card>

      <Card title="Objectifs" action={<button className="link" onClick={() => navigate('/plan')}>Gérer</button>}>
        {goals.length === 0 ? (
          <Empty>Fixe-toi des objectifs (km, heures, séances) par semaine, mois ou année dans l'onglet Plan.</Empty>
        ) : (
          <ul className="goal-list">
            {goals.map(({ goal, done, ratio, elapsed }) => (
              <li key={goal.id}>
                <div className="row-between">
                  <span>
                    {scopeLabel(goal.scope)} <span className="muted small">{PERIOD_LABELS[goal.period]}</span>
                  </span>
                  <span className="small">
                    <b>{formatNumber(goal.metric === 'duration' ? Math.round(done * 10) / 10 : done)}</b> / {formatNumber(goal.target)} {METRIC_UNITS[goal.metric]}
                  </span>
                </div>
                <ProgressBar ratio={ratio} elapsed={elapsed} label={`${scopeLabel(goal.scope)} ${PERIOD_LABELS[goal.period]}`} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {upcoming.length > 0 && (
        <Card title="À venir" action={<button className="link" onClick={() => navigate('/plan')}>Calendrier</button>}>
          <ul className="plan-list">
            {upcoming.map((p) => (
              <li key={p.id} className={p.date < todayIso ? 'overdue' : ''}>
                <span aria-hidden="true">{SPORTS[p.sport].icon}</span>
                <span className="grow">
                  <strong>{p.title}</strong>
                  <span className="muted small"> · {p.date === todayIso ? "aujourd'hui" : formatDate(p.date)}</span>
                </span>
                {p.date <= todayIso && (
                  <button className="btn small primary" onClick={() => navigate(`/ajouter/${p.sport}?plan=${p.id}`)}>
                    Fait ✓
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Temps d'entraînement (12 semaines)">
        <StackedBarChart
          ariaLabel="Heures d'entraînement par semaine et par catégorie"
          labels={weeks.map((w) => shortDate.format(parseLocalDate(w.weekStart)))}
          titles={weeks.map((w) => `Semaine du ${longDate.format(parseLocalDate(w.weekStart))}`)}
          highlight={weeks.length - 1}
          series={CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABELS[c], color: CATEGORY_COLORS[c], values: weeks.map((w) => w.seconds[c] / 3600) }))}
          formatValue={(h) => formatHours(h * 3600)}
          formatAxis={(h) => `${formatNumber(h)} h`}
        />
      </Card>

      {shares.length > 0 && (
        <Card title="Répartition (30 jours)">
          <ul className="share-list">
            {shares.map((s) => (
              <li key={s.sport}>
                <span className="share-label">
                  {SPORTS[s.sport].icon} {SPORTS[s.sport].label}
                </span>
                <span className="share-bar">
                  <span style={{ width: `${(s.durationSeconds / maxShare) * 100}%`, background: `var(${CATEGORY_COLORS[SPORTS[s.sport].category]})` }} />
                </span>
                <span className="share-value small">
                  {formatHours(s.durationSeconds)} · {s.count}×
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(runs.length > 0 || races.length > 0 || wods.length > 0 || lifts.length > 0 || runHL.longest) && (
        <Card title="Records 🏆">
          {(runs.length > 0 || runHL.longest) && (
            <>
              <h3 className="sub">Course à pied</h3>
              <ul className="records">
                {runs.map((r) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <strong>{formatDuration(r.seconds)}</strong>
                    <span className="muted small">{formatDate(r.activity.date)}</span>
                  </li>
                ))}
                {runHL.longest && (
                  <li>
                    <span>Plus longue sortie</span>
                    <strong>{formatKm(runHL.longest.distanceMeters!)}</strong>
                    <span className="muted small">{formatDate(runHL.longest.date)}</span>
                  </li>
                )}
                {runHL.fastest && (
                  <li>
                    <span>Meilleure allure</span>
                    <strong>{formatPace(paceSecondsPerKm(runHL.fastest.distanceMeters!, runHL.fastest.durationSeconds))}</strong>
                    <span className="muted small">{formatDate(runHL.fastest.date)}</span>
                  </li>
                )}
              </ul>
            </>
          )}
          {races.length > 0 && (
            <>
              <h3 className="sub">HYROX / ATH X</h3>
              <ul className="records">
                {races.map((r) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <strong>{formatDuration(r.seconds)}</strong>
                    <span className="muted small">{formatDate(r.activity.date)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {wods.length > 0 && (
            <>
              <h3 className="sub">Benchmarks CrossFit</h3>
              <ul className="records">
                {wods.map((w) => (
                  <li key={w.wodName}>
                    <span>{w.wodName}</span>
                    <strong>{w.score}</strong>
                    <span className="muted small">
                      {formatDate(w.activity.date)} · {w.attempts} tentative{w.attempts > 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {lifts.length > 0 && (
            <>
              <h3 className="sub">Charges max</h3>
              <ul className="records">
                {lifts.map((l) => (
                  <li key={l.exercise}>
                    <span>{l.exercise}</span>
                    <strong>
                      {formatNumber(l.weightKg)} kg × {l.reps}
                    </strong>
                    <span className="muted small">{formatDate(l.date)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {activities.length > 0 && (
        <Card title="Dernières séances" action={<button className="link" onClick={() => navigate('/journal')}>Tout voir</button>}>
          <ul className="activity-list">
            {activities.slice(0, 3).map((a) => (
              <li key={a.id}>
                <ActivityCard activity={a} compact />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
