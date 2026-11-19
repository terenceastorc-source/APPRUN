import { formatDate, formatDuration, formatKm, formatPace, paceSecondsPerKm } from '../domain/format';
import { distanceRecords, highlights, periodSummary, weekStreak, weeklyDistance, type Totals } from '../domain/stats';
import type { Run, Settings } from '../domain/types';
import { WeeklyChart } from './WeeklyChart';

interface Props {
  runs: Run[];
  settings: Settings;
  onAdd(): void;
  today?: Date;
}

function StatCard({ title, t }: { title: string; t: Totals }) {
  return (
    <div className="stat">
      <span className="stat-title">{title}</span>
      <span className="stat-value">{formatKm(t.distanceMeters)}</span>
      <span className="stat-sub">
        {t.count} sortie{t.count > 1 ? 's' : ''} · {formatDuration(t.durationSeconds)}
      </span>
      <span className="stat-sub">{formatPace(t.avgPace)}</span>
    </div>
  );
}

export function Dashboard({ runs, settings, onAdd, today = new Date() }: Props) {
  if (runs.length === 0) {
    return (
      <section className="card empty">
        <h2>Bienvenue sur APPRUN 👟</h2>
        <p>Enregistre ta première sortie pour suivre ton kilométrage, ton allure et tes records.</p>
        <button className="btn primary" onClick={onAdd}>
          Ajouter une sortie
        </button>
      </section>
    );
  }

  const summary = periodSummary(runs, today);
  const weeks = weeklyDistance(runs, 12, today);
  const records = distanceRecords(runs);
  const best = highlights(runs);
  const streak = weekStreak(runs, today);
  const goal = settings.weeklyGoalKm;
  const weekKm = summary.week.distanceMeters / 1000;
  const progress = goal > 0 ? Math.min(weekKm / goal, 1) : 0;

  return (
    <div className="stack">
      {goal > 0 && (
        <section className="card">
          <div className="row-between">
            <h2>Objectif de la semaine</h2>
            <span className="muted">
              {weekKm.toFixed(1).replace('.', ',')} / {goal} km
            </span>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Number(weekKm.toFixed(1))} aria-label="Progression hebdomadaire">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="muted small">
            {progress >= 1 ? 'Objectif atteint, bravo ! 🎉' : `Encore ${(goal - weekKm).toFixed(1).replace('.', ',')} km pour l'atteindre.`}
            {streak > 1 && ` · ${streak} semaines d'affilée avec au moins une sortie 🔥`}
          </p>
        </section>
      )}

      <section className="stats-grid" aria-label="Totaux">
        <StatCard title="Cette semaine" t={summary.week} />
        <StatCard title="Ce mois-ci" t={summary.month} />
        <StatCard title="Cette année" t={summary.year} />
        <StatCard title="Depuis le début" t={summary.all} />
      </section>

      <section className="card">
        <h2>Kilométrage (12 semaines)</h2>
        <WeeklyChart weeks={weeks} goalKm={goal} />
      </section>

      <section className="card">
        <h2>Records</h2>
        {records.length === 0 ? (
          <p className="muted">Cours un 5 km, 10 km, semi ou marathon pour voir tes records ici.</p>
        ) : (
          <ul className="records">
            {records.map((r) => (
              <li key={r.label}>
                <span>{r.label}</span>
                <strong>{formatDuration(r.timeSeconds)}</strong>
                <span className="muted small">{formatDate(r.run.date)}</span>
              </li>
            ))}
          </ul>
        )}
        <ul className="records">
          {best.longest && (
            <li>
              <span>Plus longue sortie</span>
              <strong>{formatKm(best.longest.distanceMeters)}</strong>
              <span className="muted small">{formatDate(best.longest.date)}</span>
            </li>
          )}
          {best.fastest && (
            <li>
              <span>Meilleure allure</span>
              <strong>{formatPace(paceSecondsPerKm(best.fastest.distanceMeters, best.fastest.durationSeconds))}</strong>
              <span className="muted small">{formatDate(best.fastest.date)}</span>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
