import { parseLocalDate } from '../domain/format';
import type { WeekBucket } from '../domain/stats';

interface Props {
  weeks: WeekBucket[];
  goalKm?: number;
}

const W = 340;
const H = 160;
const PAD = { top: 22, right: 8, bottom: 22, left: 28 };

/** Histogramme SVG du kilométrage hebdomadaire, sans dépendance externe. */
export function WeeklyChart({ weeks, goalKm = 0 }: Props) {
  const values = weeks.map((w) => w.distanceMeters / 1000);
  const max = Math.max(goalKm, ...values, 5);
  const niceMax = Math.ceil(max / 10) * 10; // multiple de 10 : graduations entières
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(weeks.length, 1);
  const barW = Math.max(slot * 0.62, 2);
  const y = (km: number) => PAD.top + innerH - (km / niceMax) * innerH;
  const ticks = [0, niceMax / 2, niceMax];
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Kilomètres par semaine">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid-line" />
          <text x={PAD.left - 6} y={y(t) + 3} className="axis-label" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const km = values[i] ?? 0;
        const x = PAD.left + i * slot + (slot - barW) / 2;
        const isCurrent = i === weeks.length - 1;
        const reached = goalKm > 0 && km >= goalKm;
        return (
          <g key={w.weekStart}>
            <rect x={x} y={y(km)} width={barW} height={Math.max(innerH - (y(km) - PAD.top), 0)} rx={2} className={`bar${isCurrent ? ' current' : ''}${reached ? ' reached' : ''}`}>
              <title>{`Semaine du ${fmt.format(parseLocalDate(w.weekStart))} : ${km.toFixed(1)} km (${w.count} sortie${w.count > 1 ? 's' : ''})`}</title>
            </rect>
            {(i % 3 === 0 || isCurrent) && (
              <text x={x + barW / 2} y={H - 6} className="axis-label" textAnchor="middle">
                {isCurrent ? 'Cette sem.' : fmt.format(parseLocalDate(w.weekStart))}
              </text>
            )}
          </g>
        );
      })}
      {goalKm > 0 && (
        <g>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(goalKm)} y2={y(goalKm)} className="goal-line" />
          <text x={W - PAD.right} y={y(goalKm) - 4} className="axis-label goal-label" textAnchor="end">
            Objectif {goalKm} km
          </text>
        </g>
      )}
    </svg>
  );
}
