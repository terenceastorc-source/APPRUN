import { formatDuration, formatSpeedFor } from '../domain/format';
import { SPORTS } from '../domain/sports';
import type { Activity, AppData } from '../domain/types';
import { migrate } from './database';
import type { StoredTrack } from './tracks';

export interface ExportFile {
  app: 'apprun';
  exportedAt: string;
  data: AppData;
  tracks?: StoredTrack[];
}

export function exportJson(data: AppData, tracks: StoredTrack[] = []): string {
  // Le code d'accès au serveur IA ne quitte pas l'appareil.
  const { aiCode: _secret, ...settings } = data.settings;
  void _secret;
  const file: ExportFile = { app: 'apprun', exportedAt: new Date().toISOString(), data: { ...data, settings }, tracks };
  return JSON.stringify(file);
}

export class ImportError extends Error {}

/**
 * Lit une sauvegarde : format actuel ({ data }), ancien export v1 ({ runs }) ou tableau brut de courses.
 * Les entrées invalides sont ignorées par la migration.
 */
export function parseImport(text: string): { data: AppData; tracks: StoredTrack[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError("Le fichier n'est pas un JSON valide.");
  }
  if (Array.isArray(parsed)) return { data: migrate({ version: 1, runs: parsed }), tracks: [] };
  if (typeof parsed !== 'object' || parsed === null) throw new ImportError('Format de fichier non reconnu.');
  const p = parsed as Record<string, unknown>;
  if (p.data && typeof p.data === 'object') {
    const tracks = Array.isArray(p.tracks) ? (p.tracks as StoredTrack[]).filter((t) => typeof t?.activityId === 'string' && Array.isArray(t.segments)) : [];
    return { data: migrate(p.data), tracks };
  }
  if (Array.isArray(p.runs)) return { data: migrate({ version: 1, runs: p.runs }), tracks: [] };
  throw new ImportError('Aucune donnée APPRUN trouvée dans le fichier.');
}

function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export CSV des activités (séparateur « ; » pour Excel en français). */
export function exportCsv(activities: readonly Activity[]): string {
  const header = ['Date', 'Heure', 'Sport', 'Titre', 'Durée', 'Distance (km)', 'Allure/Vitesse', 'D+ (m)', 'RPE', 'FC moy.', 'FC max', 'WOD', 'Score', 'Notes'];
  const rows = activities.map((a) =>
    [
      a.date,
      a.startTime,
      SPORTS[a.sport].label,
      a.title,
      formatDuration(a.durationSeconds),
      a.distanceMeters ? (a.distanceMeters / 1000).toFixed(2).replace('.', ',') : undefined,
      a.distanceMeters ? formatSpeedFor(SPORTS[a.sport].paceUnit, a.distanceMeters, a.durationSeconds) : undefined,
      a.elevationGain,
      a.rpe,
      a.heartRateAvg,
      a.heartRateMax,
      a.crossfit?.wodName,
      a.crossfit?.score,
      a.notes,
    ]
      .map(csvCell)
      .join(';'),
  );
  return [header.join(';'), ...rows].join('\n');
}
