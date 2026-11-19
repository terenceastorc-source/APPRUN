import { formatDuration, paceSecondsPerKm, formatPace } from '../domain/format';
import { RUN_TYPE_LABELS, type Run } from '../domain/types';
import { isValidRun } from './repository';

export function exportJson(runs: readonly Run[]): string {
  return JSON.stringify({ app: 'apprun', version: 1, exportedAt: new Date().toISOString(), runs }, null, 2);
}

export class ImportError extends Error {}

/** Lit un export JSON (objet `{ runs }` ou tableau brut). Les entrées invalides sont ignorées. */
export function parseJsonImport(text: string): { runs: Run[]; skipped: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError("Le fichier n'est pas un JSON valide.");
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { runs?: unknown })?.runs;
  if (!Array.isArray(list)) throw new ImportError('Aucune liste de courses trouvée dans le fichier.');
  const runs = list.filter(isValidRun);
  return { runs, skipped: list.length - runs.length };
}

function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export CSV (séparateur « ; » pour une ouverture directe dans Excel en français). */
export function exportCsv(runs: readonly Run[]): string {
  const header = ['Date', 'Type', 'Distance (km)', 'Durée', 'Allure', 'Ressenti', 'FC moy.', 'D+ (m)', 'Notes'];
  const rows = runs.map((r) =>
    [
      r.date,
      RUN_TYPE_LABELS[r.type],
      (r.distanceMeters / 1000).toFixed(2).replace('.', ','),
      formatDuration(r.durationSeconds),
      formatPace(paceSecondsPerKm(r.distanceMeters, r.durationSeconds)),
      r.effort,
      r.heartRateAvg,
      r.elevationGain,
      r.notes,
    ]
      .map(csvCell)
      .join(';'),
  );
  return [header.join(';'), ...rows].join('\n');
}
