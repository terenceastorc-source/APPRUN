import { useMemo, useState } from 'react';
import { formatHours, parseLocalDate } from '../domain/format';
import { CATEGORIES, CATEGORY_LABELS, SPORTS, SPORT_IDS } from '../domain/sports';
import { matchesScope, totals } from '../domain/stats';
import type { Activity, GoalScope } from '../domain/types';
import { navigate } from '../hooks/useRoute';
import { ActivityCard } from './ActivityCard';

const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

export function Journal({ activities }: { activities: Activity[] }) {
  const [scope, setScope] = useState<GoalScope>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter((a) => {
      if (!matchesScope(a, scope)) return false;
      if (!q) return true;
      return [a.title, a.notes, a.crossfit?.wodName, a.crossfit?.workout, SPORTS[a.sport].label].some((t) => t?.toLowerCase().includes(q));
    });
  }, [activities, scope, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of filtered) map.set(a.date.slice(0, 7), [...(map.get(a.date.slice(0, 7)) ?? []), a]);
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="stack">
      <div className="card filters">
        <label>
          Sport
          <select value={scope} onChange={(e) => setScope(e.target.value as GoalScope)}>
            <option value="all">Tous</option>
            {CATEGORIES.map((c) => (
              <optgroup key={c} label={CATEGORY_LABELS[c]}>
                <option value={c}>Toute la catégorie {CATEGORY_LABELS[c]}</option>
                {SPORT_IDS.filter((s) => SPORTS[s].category === c).map((s) => (
                  <option key={s} value={s}>
                    {SPORTS[s].icon} {SPORTS[s].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Rechercher
          <input type="search" placeholder="Titre, WOD, notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {groups.length === 0 && (
        <section className="card empty">
          <p className="muted">{activities.length === 0 ? 'Aucune séance enregistrée pour le moment.' : 'Aucune séance ne correspond aux filtres.'}</p>
          {activities.length === 0 && (
            <button className="btn primary" onClick={() => navigate('/ajouter')}>
              Ajouter une séance
            </button>
          )}
        </section>
      )}

      {groups.map(([month, list]) => {
        const t = totals(list);
        const label = monthFormatter.format(parseLocalDate(`${month}-01`));
        return (
          <section key={month} aria-label={label}>
            <h3 className="month-title">
              <span className="capitalize">{label}</span>
              <span className="muted small">
                {t.count} séance{t.count > 1 ? 's' : ''} · {formatHours(t.durationSeconds)}
              </span>
            </h3>
            <ul className="activity-list">
              {list.map((a) => (
                <li key={a.id}>
                  <ActivityCard activity={a} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
