/** Formate une durée en secondes : "1:02:03" ou "42:05". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/**
 * Analyse une durée saisie par l'utilisateur. Accepte "hh:mm:ss", "mm:ss"
 * ou un nombre seul interprété en minutes. Retourne null si invalide.
 */
export function parseDuration(input: string): number | null {
  const value = input.trim();
  if (value === '') return null;
  if (/^\d+([.,]\d+)?$/.test(value)) {
    const minutes = Number(value.replace(',', '.'));
    return minutes > 0 ? Math.round(minutes * 60) : null;
  }
  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? (nums as [number, number, number]) : [0, nums[0]!, nums[1]!];
  if (s >= 60 || (nums.length === 3 && m >= 60)) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

/** Allure en secondes par kilomètre. */
export function paceSecondsPerKm(distanceMeters: number, durationSeconds: number): number {
  if (distanceMeters <= 0) return 0;
  return durationSeconds / (distanceMeters / 1000);
}

/** Formate une allure : "5'12\"/km". */
export function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '–';
  let min = Math.floor(secondsPerKm / 60);
  let sec = Math.round(secondsPerKm % 60);
  if (sec === 60) {
    min += 1;
    sec = 0;
  }
  return `${min}'${String(sec).padStart(2, '0')}"/km`;
}

export function speedKmh(distanceMeters: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return distanceMeters / 1000 / (durationSeconds / 3600);
}

const kmFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export function formatKm(distanceMeters: number): string {
  return `${kmFormatter.format(distanceMeters / 1000)} km`;
}

export function parseKm(input: string): number | null {
  const n = Number(input.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export function formatDate(isoDate: string): string {
  return dateFormatter.format(parseLocalDate(isoDate));
}

/** Convertit "AAAA-MM-JJ" en Date locale (minuit), sans décalage de fuseau. */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Durée lisible : « 1 h 05 », « 45 min ». */
export function formatHours(totalSeconds: number): string {
  const min = Math.round(totalSeconds / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}\u00a0min`;
  return `${h}\u00a0h\u00a0${String(m).padStart(2, '0')}`;
}

/** Allure en min/100 m (natation). */
export function formatPacePer100m(distanceMeters: number, durationSeconds: number): string {
  if (distanceMeters <= 0) return '–';
  const s = durationSeconds / (distanceMeters / 100);
  return formatPace(s).replace('/km', '/100 m');
}

/** Allure ou vitesse selon l'unité propre au sport. */
export function formatSpeedFor(unit: 'min/km' | 'km/h' | 'min/100m' | undefined, distanceMeters: number, durationSeconds: number): string {
  if (!distanceMeters || !durationSeconds) return '–';
  if (unit === 'km/h') return `${speedKmh(distanceMeters, durationSeconds).toFixed(1).replace('.', ',')} km/h`;
  if (unit === 'min/100m') return formatPacePer100m(distanceMeters, durationSeconds);
  return formatPace(paceSecondsPerKm(distanceMeters, durationSeconds));
}

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

/** Nombre décimal saisi en français (« 72,5 »). Vide → undefined, invalide → NaN. */
export function parseOptionalNumber(value: string): number | undefined {
  const t = value.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Lundi (00:00) de la semaine contenant la date. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
