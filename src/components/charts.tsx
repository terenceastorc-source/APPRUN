import { useId, useState, type ReactNode } from 'react';

const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Graduation « propre » juste au-dessus de la valeur max, pour ne pas écraser les données. */
export function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  return (NICE_STEPS.find((s) => n <= s + 1e-9) ?? 10) * pow;
}

/** Ancrage des libellés d'axe X : les extrémités ne doivent pas sortir du graphique. */
function anchorFor(i: number, n: number): 'start' | 'middle' | 'end' {
  return i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle';
}

/** Rectangle à coins supérieurs arrondis (extrémité de donnée), base carrée. */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export interface Series {
  key: string;
  label: string;
  /** Nom de la variable CSS de couleur (ex. « --series-1 »). */
  color: string;
  values: (number | null)[];
}

export function Legend({ series }: { series: Pick<Series, 'key' | 'label' | 'color'>[] }) {
  return (
    <ul className="legend">
      {series.map((s) => (
        <li key={s.key}>
          <span className="swatch" style={{ background: `var(${s.color})` }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

const W = 340;
const PAD = { top: 12, right: 8, bottom: 22, left: 36 };

interface TooltipState {
  index: number;
  x: number;
}

function Tooltip({ title, rows, x }: { title: string; rows: ReactNode[]; x: number }) {
  // Position en % de la largeur ; on bascule à gauche au-delà de la moitié pour rester visible.
  const pct = (x / W) * 100;
  const style = pct > 55 ? { right: `${100 - pct + 2}%` } : { left: `${pct + 2}%` };
  return (
    <div className="chart-tooltip" style={style} role="status">
      <strong>{title}</strong>
      {rows}
    </div>
  );
}

interface BarProps {
  labels: string[];
  /** Libellés longs pour l'infobulle. */
  titles?: string[];
  series: Series[];
  height?: number;
  formatValue(v: number): string;
  formatAxis?(v: number): string;
  /** Index mis en avant (période courante). */
  highlight?: number;
  ariaLabel: string;
}

/** Histogramme empilé (une colonne par période, une couleur par série). */
export function StackedBarChart({ labels, titles, series, height = 170, formatValue, formatAxis = formatValue, highlight, ariaLabel }: BarProps) {
  const [hover, setHover] = useState<TooltipState | null>(null);
  const H = height;
  const totalsPerBar = labels.map((_, i) => series.reduce((s, se) => s + (se.values[i] ?? 0), 0));
  const max = niceCeil(Math.max(...totalsPerBar, 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(labels.length, 1);
  const barW = Math.min(slot * 0.65, 24);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const labelEvery = Math.ceil(labels.length / 6);
  const GAP = 2;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={PAD.left - 6} y={y(t) + 3} className="axis-label" textAnchor="end">
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {labels.map((label, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          let acc = 0;
          const visible = series.filter((s) => (s.values[i] ?? 0) > 0);
          return (
            <g key={label + i} opacity={hover && hover.index !== i ? 0.55 : 1}>
              {visible.map((s, k) => {
                const v = s.values[i] ?? 0;
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const isTop = k === visible.length - 1;
                const h = Math.max(y0 - y1 - (k > 0 ? GAP : 0), 0.5);
                return <path key={s.key} d={topRoundedRect(x, y1, barW, h, isTop ? 4 : 0)} style={{ fill: `var(${s.color})` }} />;
              })}
              {(i === highlight || (i % labelEvery === (labels.length - 1) % labelEvery && (highlight === undefined || Math.abs(i - highlight) >= Math.max(2, labelEvery)))) && (
                <text x={i === labels.length - 1 ? x + barW : x + barW / 2} y={H - 6} className={`axis-label${i === highlight ? ' strong' : ''}`} textAnchor={i === labels.length - 1 ? 'end' : 'middle'}>
                  {label}
                </text>
              )}
              {/* Zone de survol plus large que la barre. */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onPointerEnter={() => setHover({ index: i, x: x + barW / 2 })}
                onClick={() => setHover({ index: i, x: x + barW / 2 })}
              />
            </g>
          );
        })}
      </svg>
      {hover && (
        <Tooltip
          x={hover.x}
          title={titles?.[hover.index] ?? labels[hover.index] ?? ''}
          rows={[
            ...series.map((s) => (
              <span key={s.key} className="tt-row">
                <span className="swatch" style={{ background: `var(${s.color})` }} />
                {s.label} <b>{formatValue(s.values[hover.index] ?? 0)}</b>
              </span>
            )),
            series.length > 1 ? (
              <span key="total" className="tt-row">
                Total <b>{formatValue(totalsPerBar[hover.index] ?? 0)}</b>
              </span>
            ) : null,
          ]}
        />
      )}
      {series.length > 1 && <Legend series={series} />}
    </div>
  );
}

interface LineProps {
  labels: string[];
  titles?: string[];
  series: Series[];
  height?: number;
  formatValue(v: number): string;
  /** Inclure zéro dans l'axe (false pour le poids, la FC…). */
  zeroBased?: boolean;
  /** Bornes fixes de l'axe (ex. échelle 1–5). */
  domain?: [number, number];
  /** Relier les points par-dessus les jours sans mesure (mesures espacées). */
  connectGaps?: boolean;
  formatAxis?(v: number): string;
  ariaLabel: string;
}

/** Courbes (une ou plusieurs séries de même unité) avec réticule et infobulle. */
export function LineChart({ labels, titles, series, height = 170, formatValue, zeroBased = true, domain, connectGaps = false, formatAxis = formatValue, ariaLabel }: LineProps) {
  const clipId = useId();
  const [hover, setHover] = useState<TooltipState | null>(null);
  const H = height;
  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (values.length === 0) return <p className="muted small">Pas encore de données.</p>;
  let lo = zeroBased ? 0 : Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    hi += 1;
    lo = zeroBased ? 0 : lo - 1;
  }
  const span = hi - lo;
  if (domain) [lo, hi] = domain;
  else if (!zeroBased) {
    lo -= span * 0.1;
    hi += span * 0.1;
  } else hi = niceCeil(hi);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = labels.length;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const ticks = [lo, (lo + hi) / 2, hi];
  const labelEvery = Math.ceil(n / 5);

  function pathFor(vals: (number | null)[]) {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        if (!connectGaps) pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * (n - 1));
    const index = Math.max(0, Math.min(n - 1, i));
    setHover({ index, x: x(index) });
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        <clipPath id={clipId}>
          <rect x={PAD.left} y={0} width={innerW} height={H} />
        </clipPath>
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={PAD.left - 6} y={y(t) + 3} className="axis-label" textAnchor="end">
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % labelEvery === (n - 1) % labelEvery ? (
            <text key={i} x={x(i)} y={H - 6} className="axis-label" textAnchor={anchorFor(i, n)}>
              {l}
            </text>
          ) : null,
        )}
        {hover && <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + innerH} className="crosshair" />}
        {series.map((s) => (
          <g key={s.key} clipPath={`url(#${clipId})`}>
            <path d={pathFor(s.values)} fill="none" style={{ stroke: `var(${s.color})` }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {/* Points isolés (entourés d'un anneau de la couleur du fond). */}
            {s.values.map((v, i) =>
              v !== null && !connectGaps && (s.values[i - 1] ?? null) === null && (s.values[i + 1] ?? null) === null ? (
                <circle key={i} cx={x(i)} cy={y(v)} r={4} className="dot" style={{ fill: `var(${s.color})` }} />
              ) : null,
            )}
            {hover && s.values[hover.index] != null && <circle cx={x(hover.index)} cy={y(s.values[hover.index]!)} r={4.5} className="dot" style={{ fill: `var(${s.color})` }} />}
          </g>
        ))}
      </svg>
      {hover && (
        <Tooltip
          x={hover.x}
          title={titles?.[hover.index] ?? labels[hover.index] ?? ''}
          rows={series.map((s) => (
            <span key={s.key} className="tt-row">
              <span className="swatch" style={{ background: `var(${s.color})` }} />
              {s.label} <b>{s.values[hover.index] == null ? '–' : formatValue(s.values[hover.index]!)}</b>
            </span>
          ))}
        />
      )}
      {series.length > 1 && <Legend series={series} />}
    </div>
  );
}

/** Barre de progression (objectifs). */
export function ProgressBar({ ratio, elapsed, label }: { ratio: number; elapsed?: number; label: string }) {
  const pct = Math.min(ratio, 1) * 100;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <div className={`progress-fill${ratio >= 1 ? ' done' : ''}`} style={{ width: `${pct}%` }} />
      {elapsed !== undefined && elapsed < 1 && <div className="progress-marker" style={{ left: `${elapsed * 100}%` }} title="Temps écoulé dans la période" />}
    </div>
  );
}
