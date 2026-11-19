import { formatDate, formatHours, formatKm, formatSpeedFor } from '../domain/format';
import { activityLoad } from '../domain/load';
import { SPORTS } from '../domain/sports';
import { RUN_TYPE_LABELS, WOD_FORMAT_LABELS, WOD_LEVEL_LABELS, type Activity } from '../domain/types';
import { navigate } from '../hooks/useRoute';

/** Résumé d'une activité (journal, tableau de bord). Ouvre le détail au clic. */
export function ActivityCard({ activity: a, compact = false }: { activity: Activity; compact?: boolean }) {
  const info = SPORTS[a.sport];
  const subtitle = a.title ?? (a.runType ? RUN_TYPE_LABELS[a.runType] : a.crossfit?.wodName ?? info.label);
  const metrics: string[] = [formatHours(a.durationSeconds)];
  if (a.distanceMeters) metrics.unshift(formatKm(a.distanceMeters));
  if (a.distanceMeters && info.category === 'endurance') metrics.push(formatSpeedFor(info.paceUnit, a.distanceMeters, a.durationSeconds));
  if (a.crossfit) metrics.push([WOD_FORMAT_LABELS[a.crossfit.format], WOD_LEVEL_LABELS[a.crossfit.level], a.crossfit.score].filter(Boolean).join(' · '));
  if (a.race) metrics.push(a.race.official ? 'Course officielle' : 'Entraînement');
  const load = activityLoad(a);

  return (
    <button className={`activity-card cat-${info.category}${compact ? ' compact' : ''}`} onClick={() => navigate(`/activite/${a.id}`)}>
      <span className="activity-icon" aria-hidden="true">
        {info.icon}
      </span>
      <span className="activity-body">
        <span className="activity-title">
          <strong>{subtitle}</strong>
          {a.source === 'gps' && <span className="badge small-badge">GPS</span>}
        </span>
        <span className="muted small">
          {info.label} · {formatDate(a.date)}
          {a.startTime ? ` · ${a.startTime}` : ''}
        </span>
        <span className="activity-metrics">{metrics.join('  ·  ')}</span>
      </span>
      {!compact && load > 0 && (
        <span className="activity-load" title="Charge (durée × RPE)">
          {load}
          <small>pts</small>
        </span>
      )}
    </button>
  );
}
