import { useMemo, useState } from 'react';
import { formatDate, formatDuration, formatKm, formatPace, paceSecondsPerKm, parseLocalDate } from '../domain/format';
import { totals } from '../domain/stats';
import { RUN_TYPES, RUN_TYPE_LABELS, type Run, type RunType } from '../domain/types';

interface Props {
  runs: Run[];
  onEdit(run: Run): void;
  onDelete(run: Run): void;
}

const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

export function RunList({ runs, onEdit, onDelete }: Props) {
  const [type, setType] = useState<RunType | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((r) => (type === 'all' || r.type === type) && (!q || (r.notes ?? '').toLowerCase().includes(q)));
  }, [runs, type, query]);

  // Regroupement par mois (les courses arrivent déjà triées par date décroissante).
  const groups = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const r of filtered) {
      const key = r.date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="stack">
      <div className="card filters">
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as RunType | 'all')}>
            <option value="all">Tous</option>
            {RUN_TYPES.map((t) => (
              <option key={t} value={t}>
                {RUN_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rechercher
          <input type="search" placeholder="Dans les notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {groups.length === 0 && <p className="card muted">{runs.length === 0 ? 'Aucune sortie enregistrée pour le moment.' : 'Aucune sortie ne correspond aux filtres.'}</p>}

      {groups.map(([month, list]) => {
        const t = totals(list);
        return (
          <section key={month} aria-label={monthFormatter.format(parseLocalDate(`${month}-01`))}>
            <h3 className="month-title">
              <span>{monthFormatter.format(parseLocalDate(`${month}-01`))}</span>
              <span className="muted small">
                {formatKm(t.distanceMeters)} · {t.count} sortie{t.count > 1 ? 's' : ''}
              </span>
            </h3>
            <ul className="run-list">
              {list.map((r) => (
                <li key={r.id} className="card run-item">
                  <div className="run-main">
                    <div>
                      <span className={`badge badge-${r.type}`}>{RUN_TYPE_LABELS[r.type]}</span>
                      <span className="muted small"> {formatDate(r.date)}</span>
                    </div>
                    <div className="run-metrics">
                      <strong>{formatKm(r.distanceMeters)}</strong>
                      <span>{formatDuration(r.durationSeconds)}</span>
                      <span>{formatPace(paceSecondsPerKm(r.distanceMeters, r.durationSeconds))}</span>
                    </div>
                    {(r.heartRateAvg || r.elevationGain || r.effort) && (
                      <div className="muted small">
                        {[r.effort && `Ressenti ${r.effort}/5`, r.heartRateAvg && `${r.heartRateAvg} bpm`, r.elevationGain && `D+ ${r.elevationGain} m`].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {r.notes && <p className="notes">{r.notes}</p>}
                  </div>
                  <div className="run-actions">
                    <button className="btn ghost small" onClick={() => onEdit(r)} aria-label={`Modifier la sortie du ${formatDate(r.date)}`}>
                      Modifier
                    </button>
                    <button className="btn danger small" onClick={() => onDelete(r)} aria-label={`Supprimer la sortie du ${formatDate(r.date)}`}>
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
