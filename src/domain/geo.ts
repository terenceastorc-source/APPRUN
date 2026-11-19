/** Point de trace GPS. t = horodatage (ms), alt en mètres, acc = précision horizontale (m). */
export interface TrackPoint {
  lat: number;
  lon: number;
  t: number;
  alt?: number;
  acc?: number;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance orthodromique (formule de haversine), en mètres. */
export function haversine(a: Pick<TrackPoint, 'lat' | 'lon'>, b: Pick<TrackPoint, 'lat' | 'lon'>): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface FilterOptions {
  /** Précision minimale acceptée (m). */
  maxAccuracy: number;
  /** Déplacement minimal entre deux points retenus (m), pour ignorer le bruit à l'arrêt. */
  minStep: number;
  /** Vitesse maximale plausible (m/s) : au-delà, le point est un saut GPS. */
  maxSpeed: number;
}

export const DEFAULT_FILTER: FilterOptions = { maxAccuracy: 35, minStep: 3, maxSpeed: 25 };

/**
 * Décide si un nouveau point doit être ajouté à la trace.
 * Rejette les points imprécis, les micro-déplacements (bruit) et les sauts irréalistes.
 */
export function acceptPoint(prev: TrackPoint | undefined, next: TrackPoint, opts: FilterOptions = DEFAULT_FILTER): boolean {
  if (next.acc !== undefined && next.acc > opts.maxAccuracy) return false;
  if (!prev) return true;
  const d = haversine(prev, next);
  if (d < opts.minStep) return false;
  const dt = (next.t - prev.t) / 1000;
  return dt <= 0 ? false : d / dt <= opts.maxSpeed;
}

export function trackDistance(points: readonly TrackPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1]!, points[i]!);
  return d;
}

/** Dénivelé positif avec un seuil d'hystérésis pour ne pas cumuler le bruit altimétrique. */
export function elevationGain(points: readonly TrackPoint[], threshold = 3): number {
  let gain = 0;
  let ref: number | undefined;
  for (const p of points) {
    if (p.alt === undefined) continue;
    if (ref === undefined) ref = p.alt;
    else if (p.alt - ref >= threshold) {
      gain += p.alt - ref;
      ref = p.alt;
    } else if (ref - p.alt >= threshold) ref = p.alt;
  }
  return Math.round(gain);
}

/**
 * Temps par kilomètre (s), par interpolation linéaire au passage de chaque km.
 * `segments` : liste de portions actives (les pauses séparent les portions).
 */
export function kmSplits(segments: readonly (readonly TrackPoint[])[]): number[] {
  const splits: number[] = [];
  let dist = 0;
  let activeTime = 0;
  let lastSplitTime = 0;
  let nextKm = 1000;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      const a = seg[i - 1]!;
      const b = seg[i]!;
      const d = haversine(a, b);
      const dt = (b.t - a.t) / 1000;
      while (d > 0 && dist + d >= nextKm) {
        const crossing = activeTime + dt * ((nextKm - dist) / d);
        splits.push(Math.round(crossing - lastSplitTime));
        lastSplitTime = crossing;
        nextKm += 1000;
      }
      dist += d;
      activeTime += dt;
    }
  }
  return splits;
}

/** Allure instantanée (s/km) lissée sur les `windowSeconds` dernières secondes de la portion en cours. */
export function currentPace(points: readonly TrackPoint[], windowSeconds = 30): number | null {
  const last = points[points.length - 1];
  if (!last) return null;
  let i = points.length - 1;
  while (i > 0 && (last.t - points[i - 1]!.t) / 1000 <= windowSeconds) i--;
  const window = points.slice(i);
  const d = trackDistance(window);
  const dt = (last.t - window[0]!.t) / 1000;
  if (d < 10 || dt <= 0) return null;
  return dt / (d / 1000);
}

/** Réduit une trace (Douglas-Peucker simplifié par distance minimale) pour le stockage. */
export function downsample(points: readonly TrackPoint[], minMeters = 8): TrackPoint[] {
  if (points.length <= 2) return [...points];
  const out = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) if (haversine(out[out.length - 1]!, points[i]!) >= minMeters) out.push(points[i]!);
  out.push(points[points.length - 1]!);
  return out;
}
