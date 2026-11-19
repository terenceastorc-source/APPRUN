import { lazy, Suspense, useEffect, useState } from 'react';
import { formatDate, formatDuration, formatKm, formatPace, formatSpeedFor } from '../domain/format';
import { segmentBreakdown } from '../domain/hyrox';
import { activityLoad } from '../domain/load';
import { bestSegments, estimateOneRepMax } from '../domain/records';
import { SPORTS } from '../domain/sports';
import { RUN_TYPE_LABELS, WOD_FORMAT_LABELS, WOD_LEVEL_LABELS, type Activity } from '../domain/types';
import { navigate } from '../hooks/useRoute';
import { trackStore, type StoredTrack } from '../storage/tracks';
import { Card, RPE_LABELS } from './ui';

const TrackMap = lazy(() => import('./TrackMap').then((m) => ({ default: m.TrackMap })));

interface Props {
  activity: Activity;
  all: Activity[];
  onDelete(): void;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ActivityDetail({ activity: a, all, onDelete }: Props) {
  const info = SPORTS[a.sport];
  const [track, setTrack] = useState<StoredTrack | null>(null);

  useEffect(() => {
    if (!a.hasTrack) return;
    trackStore
      .get(a.id)
      .then((t) => setTrack(t ?? null))
      .catch(() => setTrack(null));
  }, [a.id, a.hasTrack]);

  const metrics: [string, string][] = [['Durée', formatDuration(a.durationSeconds)]];
  if (a.distanceMeters) metrics.push(['Distance', formatKm(a.distanceMeters)]);
  if (a.distanceMeters && info.category === 'endurance') metrics.push([info.paceUnit === 'km/h' ? 'Vitesse' : 'Allure', formatSpeedFor(info.paceUnit, a.distanceMeters, a.durationSeconds)]);
  if (a.elevationGain) metrics.push(['D+', `${a.elevationGain} m`]);
  if (a.rpe) metrics.push(['Effort', `${a.rpe}/10 · ${RPE_LABELS[a.rpe - 1]}`]);
  if (activityLoad(a)) metrics.push(['Charge', `${activityLoad(a)} pts`]);
  if (a.heartRateAvg) metrics.push(['FC moy.', `${a.heartRateAvg} bpm`]);
  if (a.heartRateMax) metrics.push(['FC max', `${a.heartRateMax} bpm`]);
  if (a.calories) metrics.push(['Calories', `${a.calories} kcal`]);

  const segBest = a.race ? bestSegments(all, a.sport as 'hyrox' | 'athx') : null;
  const breakdown = a.race ? segmentBreakdown(a.race.segments) : null;

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>
              {info.icon} {a.title ?? (a.runType ? RUN_TYPE_LABELS[a.runType] : a.crossfit?.wodName ?? info.label)}
            </h2>
            <p className="muted small">
              {info.label} · {formatDate(a.date)}
              {a.startTime ? ` à ${a.startTime}` : ''}
              {a.source === 'gps' ? ' · enregistré au GPS' : ''}
            </p>
          </div>
        </div>
        <div className="metrics-grid">
          {metrics.map(([l, v]) => (
            <Metric key={l} label={l} value={v} />
          ))}
        </div>
        {a.notes && <p className="notes">{a.notes}</p>}
      </section>

      {a.hasTrack && (
        <Card title="Parcours">
          {track ? (
            <Suspense fallback={<div className="map map-placeholder">Chargement de la carte…</div>}>
              <TrackMap segments={track.segments} />
            </Suspense>
          ) : (
            <p className="muted small">Trace GPS indisponible sur cet appareil.</p>
          )}
        </Card>
      )}

      {a.splits && a.splits.length > 0 && (
        <Card title="Temps au kilomètre">
          <table className="table">
            <thead>
              <tr>
                <th>Km</th>
                <th>Temps</th>
                <th>Allure</th>
              </tr>
            </thead>
            <tbody>
              {a.splits.map((s, i) => {
                const best = Math.min(...a.splits!);
                return (
                  <tr key={i} className={s === best ? 'best' : ''}>
                    <td>{i + 1}</td>
                    <td>{formatDuration(s)}</td>
                    <td>{formatPace(s)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {a.crossfit && (
        <Card title="WOD">
          <p>
            <span className="badge">{WOD_FORMAT_LABELS[a.crossfit.format]}</span> <span className="badge">{WOD_LEVEL_LABELS[a.crossfit.level]}</span>
            {a.crossfit.wodName && <strong> {a.crossfit.wodName}</strong>}
          </p>
          {a.crossfit.score && (
            <p>
              Score : <strong>{a.crossfit.score}</strong>
            </p>
          )}
          {a.crossfit.workout && <pre className="workout">{a.crossfit.workout}</pre>}
          {a.crossfit.lifts && a.crossfit.lifts.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Exercice</th>
                  <th>Séries × reps</th>
                  <th>Charge</th>
                  <th>1RM est.</th>
                </tr>
              </thead>
              <tbody>
                {a.crossfit.lifts.map((l, i) => (
                  <tr key={i}>
                    <td>{l.exercise}</td>
                    <td>
                      {l.sets} × {l.reps}
                    </td>
                    <td>{l.weightKg ? `${l.weightKg} kg` : '–'}</td>
                    <td>{l.weightKg ? `${Math.round(estimateOneRepMax(l.weightKg, l.reps))} kg` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {a.race && (
        <Card title={a.race.official ? `Course officielle${a.race.division ? ` · ${a.race.division}` : ''}` : `Entraînement${a.race.division ? ` · ${a.race.division}` : ''}`}>
          {a.race.rank && (
            <p>
              Classement : <strong>{a.race.rank}e</strong>
            </p>
          )}
          {breakdown && (breakdown.run > 0 || breakdown.station > 0) && (
            <div className="metrics-grid">
              {breakdown.run > 0 && <Metric label="Course" value={formatDuration(breakdown.run)} />}
              {breakdown.station > 0 && <Metric label="Ateliers" value={formatDuration(breakdown.station)} />}
              {breakdown.roxzone > 0 && <Metric label="Roxzone" value={formatDuration(breakdown.roxzone)} />}
            </div>
          )}
          {a.race.segments.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Temps</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {a.race.segments.map((s, i) => {
                  const best = segBest?.get(s.name);
                  const isBest = s.seconds !== undefined && best === s.seconds;
                  return (
                    <tr key={i} className={isBest ? 'best' : ''}>
                      <td>{s.name}</td>
                      <td>{s.seconds ? formatDuration(s.seconds) : '–'}</td>
                      <td>{isBest ? '🏆' : best ? formatDuration(best) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <div className="actions">
        <button className="btn danger" onClick={onDelete}>
          Supprimer
        </button>
        <button className="btn primary" onClick={() => navigate(`/activite/${a.id}/modifier`)}>
          Modifier
        </button>
      </div>
    </div>
  );
}
