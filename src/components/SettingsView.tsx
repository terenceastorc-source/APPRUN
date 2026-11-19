import { useRef, useState, type ChangeEvent } from 'react';
import { toIsoDate } from '../domain/format';
import type { Store } from '../hooks/useStore';
import { exportCsv, exportJson, ImportError, parseImport } from '../storage/exchange';
import { trackStore } from '../storage/tracks';
import { Card } from './ui';

function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsView({ store }: { store: Store }) {
  const [maxHr, setMaxHr] = useState(store.data.settings.maxHr?.toString() ?? '');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stamp = toIsoDate(new Date());
  const count = store.activities.length;

  async function exportAll() {
    const tracks = await trackStore.all().catch(() => []);
    download(`apprun-${stamp}.json`, exportJson(store.data, tracks), 'application/json');
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { data, tracks } = parseImport(await file.text());
      const n = store.importData(data, 'merge');
      await Promise.all(tracks.map((t) => trackStore.save(t))).catch(() => undefined);
      setMessage({ kind: 'ok', text: `${n} séance(s) importée(s), ${data.body.length} mesure(s), ${data.plans.length} séance(s) planifiée(s).` });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ImportError ? err.message : 'Impossible de lire le fichier.' });
    }
  }

  return (
    <div className="stack">
      <Card title="Profil">
        <div className="inline-form">
          <label>
            FC maximale (bpm)
            <input inputMode="numeric" placeholder="ex. 190" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} />
          </label>
          <button
            className="btn primary"
            onClick={() => {
              const n = Number(maxHr);
              if (maxHr && (!Number.isInteger(n) || n < 100 || n > 240)) return setMessage({ kind: 'error', text: 'FC max entre 100 et 240 bpm.' });
              store.updateSettings({ ...store.data.settings, maxHr: maxHr ? n : undefined });
              setMessage({ kind: 'ok', text: 'Profil enregistré.' });
            }}
          >
            Enregistrer
          </button>
        </div>
      </Card>

      <Card title="Mes données">
        <p className="muted small">Tout est stocké uniquement sur cet appareil. Exporte régulièrement une sauvegarde complète (JSON).</p>
        <div className="button-row">
          <button className="btn" onClick={exportAll}>
            Sauvegarde complète (JSON)
          </button>
          <button className="btn" disabled={count === 0} onClick={() => download(`apprun-seances-${stamp}.csv`, '﻿' + exportCsv(store.activities), 'text/csv;charset=utf-8')}>
            Séances (CSV)
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Importer une sauvegarde
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleFile} data-testid="import-input" />
        </div>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Supprimer définitivement toutes les données (séances, mesures, plan, objectifs) ?')) {
              store.clear();
              void trackStore.clear().catch(() => undefined);
              setMessage({ kind: 'ok', text: 'Toutes les données ont été supprimées.' });
            }
          }}
        >
          Tout effacer
        </button>
      </Card>

      <Card title="À propos">
        <p className="muted small">
          APPRUN · suivi multi-sport hors ligne. La charge d'entraînement utilise la méthode sRPE (durée × effort perçu). Cartes © contributeurs OpenStreetMap.
        </p>
      </Card>

      {message && (
        <p className={`toast ${message.kind}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
