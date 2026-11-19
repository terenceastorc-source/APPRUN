import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { RunForm } from './components/RunForm';
import { RunList } from './components/RunList';
import { SettingsPanel } from './components/SettingsPanel';
import { formatDate } from './domain/format';
import type { Run } from './domain/types';
import { useRunStore } from './hooks/useRunStore';
import type { RunRepository } from './storage/repository';

type View = 'dashboard' | 'history' | 'add' | 'settings';
const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Accueil', icon: '📊' },
  { id: 'history', label: 'Historique', icon: '📅' },
  { id: 'add', label: 'Ajouter', icon: '➕' },
  { id: 'settings', label: 'Réglages', icon: '⚙️' },
];

function viewFromHash(): View {
  const h = window.location.hash.replace('#/', '') as View;
  return VIEWS.some((v) => v.id === h) ? h : 'dashboard';
}

export function App({ repository }: { repository?: RunRepository }) {
  const store = useRunStore(repository);
  const [view, setViewState] = useState<View>(viewFromHash);
  const [editing, setEditing] = useState<Run | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Navigation par hash : le bouton retour du téléphone fonctionne.
  useEffect(() => {
    const onHash = () => setViewState(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  const setView = (v: View) => {
    if (v !== 'add') setEditing(null);
    window.location.hash = `/${v}`;
    setViewState(v);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span aria-hidden="true">🏃</span> APPRUN
        </h1>
      </header>

      <main className="content">
        {view === 'dashboard' && <Dashboard runs={store.runs} settings={store.settings} onAdd={() => setView('add')} />}
        {view === 'history' && (
          <RunList
            runs={store.runs}
            onEdit={(r) => {
              setEditing(r);
              setView('add');
            }}
            onDelete={(r) => {
              if (confirm(`Supprimer la sortie du ${formatDate(r.date)} ?`)) {
                store.deleteRun(r.id);
                setFlash('Sortie supprimée.');
              }
            }}
          />
        )}
        {view === 'add' && (
          <RunForm
            key={editing?.id ?? 'new'}
            initial={editing ?? undefined}
            onCancel={editing ? () => setView('history') : undefined}
            onSubmit={(input) => {
              if (editing) {
                store.updateRun(editing.id, input);
                setFlash('Sortie mise à jour.');
                setView('history');
              } else {
                store.addRun(input);
                setFlash('Sortie ajoutée 💪');
                setView('dashboard');
              }
            }}
          />
        )}
        {view === 'settings' && (
          <SettingsPanel runs={store.runs} settings={store.settings} onSettingsChange={store.updateSettings} onImport={store.importRuns} onClear={store.clearAll} />
        )}
      </main>

      {flash && (
        <p className="toast ok floating" role="status">
          {flash}
        </p>
      )}

      <nav className="tabbar" aria-label="Navigation principale">
        {VIEWS.map((v) => (
          <button key={v.id} className={view === v.id ? 'tab active' : 'tab'} aria-current={view === v.id ? 'page' : undefined} onClick={() => setView(v.id)}>
            <span aria-hidden="true">{v.icon}</span>
            <span>{v.id === 'add' && editing ? 'Modifier' : v.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
