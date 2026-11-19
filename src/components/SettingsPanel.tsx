import { useRef, useState, type ChangeEvent } from 'react';
import { toIsoDate } from '../domain/format';
import type { Run, Settings } from '../domain/types';
import { exportCsv, exportJson, ImportError, parseJsonImport } from '../storage/exchange';

interface Props {
  runs: Run[];
  settings: Settings;
  onSettingsChange(settings: Settings): void;
  onImport(runs: Run[]): number;
  onClear(): void;
}

function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPanel({ runs, settings, onSettingsChange, onImport, onClear }: Props) {
  const [goal, setGoal] = useState(String(settings.weeklyGoalKm));
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stamp = toIsoDate(new Date());

  function saveGoal() {
    const n = Number(goal.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      setMessage({ kind: 'error', text: "L'objectif doit être compris entre 0 et 1000 km." });
      return;
    }
    onSettingsChange({ ...settings, weeklyGoalKm: n });
    setMessage({ kind: 'ok', text: 'Objectif enregistré.' });
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { runs: imported, skipped } = parseJsonImport(await file.text());
      const n = onImport(imported);
      setMessage({ kind: 'ok', text: `${n} sortie(s) importée(s)${skipped ? `, ${skipped} ignorée(s) car invalides` : ''}.` });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ImportError ? err.message : "Impossible de lire le fichier." });
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Objectif hebdomadaire</h2>
        <div className="inline-form">
          <label>
            Kilomètres par semaine (0 pour désactiver)
            <input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
          <button className="btn primary" onClick={saveGoal}>
            Enregistrer
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Mes données</h2>
        <p className="muted small">Tes sorties sont stockées uniquement sur cet appareil. Exporte-les régulièrement pour les sauvegarder.</p>
        <div className="button-row">
          <button className="btn" disabled={runs.length === 0} onClick={() => download(`apprun-${stamp}.json`, exportJson(runs), 'application/json')}>
            Exporter (JSON)
          </button>
          <button className="btn" disabled={runs.length === 0} onClick={() => download(`apprun-${stamp}.csv`, '﻿' + exportCsv(runs), 'text/csv;charset=utf-8')}>
            Exporter (CSV)
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Importer (JSON)
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleFile} data-testid="import-input" />
        </div>
        <button
          className="btn danger"
          disabled={runs.length === 0}
          onClick={() => {
            if (confirm(`Supprimer définitivement les ${runs.length} sorties ?`)) {
              onClear();
              setMessage({ kind: 'ok', text: 'Toutes les données ont été supprimées.' });
            }
          }}
        >
          Tout effacer
        </button>
      </section>

      {message && (
        <p className={`toast ${message.kind}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
