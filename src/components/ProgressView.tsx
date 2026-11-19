import { useState } from 'react';
import {
  HR_ZONES,
  benchmarkHistory,
  benchmarkNames,
  liftHistory,
  liftNames,
  maxHeartRate,
  monthlyRunning,
  raceHistory,
  racePredictions,
  stationStats,
  timeInZones,
} from '../domain/analytics';
import { formatDate, formatDuration, formatHours, formatKm, formatNumber, formatPace, parseLocalDate } from '../domain/format';
import { navigate } from '../hooks/useRoute';
import type { Store } from '../hooks/useStore';
import { BodyView } from './BodyView';
import { LineChart, StackedBarChart } from './charts';
import { Card, Empty } from './ui';

export const PROGRESS_TABS = [
  { id: 'course', label: 'Course' },
  { id: 'crossfit', label: 'CrossFit' },
  { id: 'hyrox', label: 'HYROX' },
  { id: 'corps', label: 'Corps' },
] as const;
export type ProgressTab = (typeof PROGRESS_TABS)[number]['id'];

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'numeric' });
const monthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

export function ProgressView({ store, tab, today = new Date() }: { store: Store; tab: ProgressTab; today?: Date }) {
  return (
    <div className="stack">
      <div className="segmented full" role="tablist" aria-label="Domaine">
        {PROGRESS_TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => navigate(`/progres/${t.id}`)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'course' && <RunningProgress store={store} today={today} />}
      {tab === 'crossfit' && <CrossfitProgress store={store} />}
      {tab === 'hyrox' && <RaceProgress store={store} />}
      {tab === 'corps' && <BodyView store={store} today={today} />}
    </div>
  );
}

function RunningProgress({ store, today }: { store: Store; today: Date }) {
  const { activities, data } = store;
  const predictions = racePredictions(activities, today);
  const months = monthlyRunning(activities, 12, today);
  const hr = maxHeartRate(data.settings, activities);
  const zones = hr ? timeInZones(activities, hr.bpm, today) : [];
  const zoneTotal = zones.reduce((s, z) => s + z.seconds, 0);
  const hasRuns = activities.some((a) => a.sport === 'course');

  return (
    <>
      <Card title="Prédictions de course">
        {predictions.length === 0 ? (
          <Empty>Enregistre une course d'au moins 3 km ces 3 derniers mois pour obtenir des prédictions.</Empty>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Distance</th>
                  <th>Temps prédit</th>
                  <th>Allure</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((p) => (
                  <tr key={p.label}>
                    <td>{p.label}</td>
                    <td>
                      <strong>{formatDuration(p.seconds)}</strong>
                    </td>
                    <td>{formatPace(p.seconds / (p.meters / 1000))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small hint">
              Basé sur ta meilleure sortie récente ({formatKm(predictions[0]!.basedOn.distanceMeters!)} en {formatDuration(predictions[0]!.basedOn.durationSeconds)}, {formatDate(predictions[0]!.basedOn.date)}), formule de Riegel. Une estimation, à confirmer à
              l'entraînement — surtout pour le marathon.
            </p>
          </>
        )}
      </Card>

      {hasRuns && (
        <>
          <Card title="Kilomètres par mois">
            <StackedBarChart
              ariaLabel="Kilomètres de course par mois"
              labels={months.map((m) => monthShort.format(parseLocalDate(`${m.month}-01`)).replace('.', ''))}
              titles={months.map((m) => monthLong.format(parseLocalDate(`${m.month}-01`)))}
              highlight={months.length - 1}
              series={[{ key: 'km', label: 'Distance', color: '--series-1', values: months.map((m) => m.distanceMeters / 1000) }]}
              formatValue={(v) => `${formatNumber(v)} km`}
              formatAxis={(v) => formatNumber(v)}
            />
          </Card>
          <Card title="Allure moyenne par mois">
            <LineChart
              ariaLabel="Allure moyenne de course par mois"
              labels={months.map((m) => monthShort.format(parseLocalDate(`${m.month}-01`)).replace('.', ''))}
              titles={months.map((m) => monthLong.format(parseLocalDate(`${m.month}-01`)))}
              zeroBased={false}
              connectGaps
              series={[{ key: 'pace', label: 'Allure', color: '--series-1', values: months.map((m) => m.pace) }]}
              formatValue={(v) => formatPace(v)}
              formatAxis={(v) => formatPace(v).replace('/km', '')}
            />
            <p className="muted small hint">Plus la courbe est basse, plus tu cours vite.</p>
          </Card>
        </>
      )}

      <Card title="Zones cardiaques (28 jours)">
        {!hr ? (
          <Empty>
            Renseigne ta FC max dans les{' '}
            <button className="link" onClick={() => navigate('/reglages')}>
              réglages
            </button>{' '}
            ou la FC de tes séances pour voir tes zones.
          </Empty>
        ) : zoneTotal === 0 ? (
          <Empty>Aucune séance avec FC moyenne sur les 28 derniers jours.</Empty>
        ) : (
          <>
            <ul className="share-list">
              {zones.map((z) => (
                <li key={z.zone.id}>
                  <span className="share-label">{z.zone.label}</span>
                  <span className="share-bar">
                    <span style={{ width: `${(z.seconds / zoneTotal) * 100}%`, background: `var(--zone-${z.zone.id})` }} />
                  </span>
                  <span className="share-value small">
                    {formatHours(z.seconds)} · {Math.round((z.seconds / zoneTotal) * 100)} %
                  </span>
                </li>
              ))}
            </ul>
            <p className="muted small hint">
              FC max {hr.bpm} bpm{hr.estimated ? ' (estimée d’après tes séances — renseigne-la dans les réglages pour plus de précision)' : ''}. Chaque séance compte dans la zone de sa FC moyenne. Zones :{' '}
              {HR_ZONES.map((z) => `${z.label.split(' ')[0]} ${z.max === Number.POSITIVE_INFINITY ? `≥ ${Math.round(z.min * hr.bpm)}` : `< ${Math.round(z.max * hr.bpm)}`}`).join(' · ')} bpm.
            </p>
          </>
        )}
      </Card>
    </>
  );
}

function CrossfitProgress({ store }: { store: Store }) {
  const { activities } = store;
  const names = benchmarkNames(activities);
  const lifts = liftNames(activities);
  const [wod, setWod] = useState(names[0] ?? '');
  const [lift, setLift] = useState(lifts[0] ?? '');
  const history = wod ? benchmarkHistory(activities, wod) : null;
  const liftH = lift ? liftHistory(activities, lift) : [];
  const amrap = history ? !history.lowerIsBetter : false;
  const fmt = (v: number) => (amrap ? `${formatNumber(v)} tours` : formatDuration(v));

  return (
    <>
      <Card title="Benchmarks">
        {names.length === 0 ? (
          <Empty>Donne un nom à tes WOD (Fran, Cindy…) avec un score pour suivre ta progression.</Empty>
        ) : (
          <>
            <label>
              WOD
              <select value={wod} onChange={(e) => setWod(e.target.value)}>
                {names.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            {history && history.points.length > 0 && (
              <>
                <LineChart
                  ariaLabel={`Progression sur ${wod}`}
                  labels={history.points.map((p) => shortDate.format(parseLocalDate(p.date)))}
                  titles={history.points.map((p) => `${formatDate(p.date)} · ${p.score}${p.rx ? ' RX' : ' Scaled'}`)}
                  zeroBased={false}
                  series={[{ key: 's', label: wod, color: '--series-2', values: history.points.map((p) => (amrap ? p.value / 1000 : p.value)) }]}
                  formatValue={fmt}
                  formatAxis={(v) => (amrap ? formatNumber(Math.round(v * 10) / 10) : formatDuration(v))}
                />
                <p className="muted small hint">
                  {history.lowerIsBetter ? 'Temps : plus bas = meilleur.' : 'Tours : plus haut = meilleur.'} {history.points.length} tentative{history.points.length > 1 ? 's' : ''}
                  {history.points.length > 1 &&
                    (() => {
                      const first = history.points[0]!;
                      const last = history.points[history.points.length - 1]!;
                      const better = history.lowerIsBetter ? last.value < first.value : last.value > first.value;
                      return better ? ` · progrès depuis le ${formatDate(first.date)} : ${first.score} → ${last.score} 💪` : '';
                    })()}
                </p>
              </>
            )}
          </>
        )}
      </Card>

      <Card title="Force (1RM estimé)">
        {lifts.length === 0 ? (
          <Empty>Ajoute des exercices de force avec leur charge dans tes séances CrossFit.</Empty>
        ) : (
          <>
            <label>
              Exercice
              <select value={lift} onChange={(e) => setLift(e.target.value)}>
                {lifts.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            {liftH.length > 0 && (
              <>
                <LineChart
                  ariaLabel={`1RM estimé en ${lift}`}
                  labels={liftH.map((p) => shortDate.format(parseLocalDate(p.date)))}
                  titles={liftH.map((p) => `${formatDate(p.date)} · ${formatNumber(p.weightKg)} kg × ${p.reps}`)}
                  zeroBased={false}
                  series={[{ key: 'rm', label: '1RM estimé', color: '--series-2', values: liftH.map((p) => p.oneRm) }]}
                  formatValue={(v) => `${formatNumber(v)} kg`}
                  formatAxis={(v) => formatNumber(Math.round(v))}
                />
                <p className="muted small hint">
                  Meilleur 1RM estimé : <strong>{formatNumber(Math.max(...liftH.map((p) => p.oneRm)))} kg</strong> (formule d'Epley, à partir de la charge et des répétitions).
                </p>
              </>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function RaceProgress({ store }: { store: Store }) {
  const { activities } = store;
  const sports = (['hyrox', 'athx'] as const).filter((s) => activities.some((a) => a.sport === s && a.race));
  const [sport, setSport] = useState<'hyrox' | 'athx'>(sports[0] ?? 'hyrox');
  const history = raceHistory(activities, sport);
  const stats = stationStats(activities, sport);
  const worst = stats.filter((s) => s.count > 1).sort((a, b) => b.gap / b.best - a.gap / a.best)[0];

  if (sports.length === 0)
    return (
      <Card>
        <Empty>Enregistre une simulation ou une course HYROX / ATH X avec ses temps par segment pour voir tes analyses.</Empty>
      </Card>
    );

  return (
    <>
      {sports.length > 1 && (
        <div className="segmented" role="group" aria-label="Épreuve">
          {sports.map((s) => (
            <button key={s} className={sport === s ? 'active' : ''} aria-pressed={sport === s} onClick={() => setSport(s)}>
              {s === 'hyrox' ? 'HYROX' : 'ATH X'}
            </button>
          ))}
        </div>
      )}
      <Card title="Temps total">
        <LineChart
          ariaLabel="Temps total par épreuve"
          labels={history.map((h) => shortDate.format(parseLocalDate(h.date)))}
          titles={history.map((h) => `${formatDate(h.date)} · ${h.official ? 'course officielle' : 'entraînement'}`)}
          zeroBased={false}
          series={[{ key: 't', label: 'Temps', color: '--series-3', values: history.map((h) => h.seconds) }]}
          formatValue={(v) => formatDuration(v)}
        />
        <p className="muted small hint">Plus bas = plus rapide. Les entraînements partiels faussent la courbe : renseigne le type (entraînement / officielle).</p>
      </Card>
      <Card title="Par segment">
        {stats.length === 0 ? (
          <Empty>Saisis les temps de chaque segment pour comparer tes ateliers.</Empty>
        ) : (
          <>
            {worst && worst.gap > 0 && (
              <p className="pace-preview">
                À travailler : <strong>{worst.name}</strong>, {formatDuration(worst.gap)} au-dessus de ton record la dernière fois.
              </p>
            )}
            <table className="table">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Dernier</th>
                  <th>Record</th>
                  <th>Moy.</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.name} className={s.gap === 0 && s.count > 1 ? 'best' : ''}>
                    <td>{s.name}</td>
                    <td>{formatDuration(s.last)}</td>
                    <td>{formatDuration(s.best)}</td>
                    <td>{formatDuration(s.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </>
  );
}
