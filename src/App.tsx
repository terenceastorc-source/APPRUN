import { useEffect, useState } from 'react';
import { ActivityDetail } from './components/ActivityDetail';
import { ActivityForm } from './components/ActivityForm';
import { Dashboard } from './components/Dashboard';
import { Journal } from './components/Journal';
import { LiveTracker } from './components/LiveTracker';
import { PlanView } from './components/PlanView';
import { ProgramsView } from './components/ProgramsView';
import { PROGRESS_TABS, ProgressView, type ProgressTab } from './components/ProgressView';
import { SettingsView } from './components/SettingsView';
import { SportPicker } from './components/SportPicker';
import { TimerView } from './components/TimerView';
import { takePrefill } from './components/WodPhoto';
import { isSportId } from './domain/sports';
import { TIMER_MODES, type TimerMode } from './domain/timer';
import { WOD_FORMATS, type WodFormat } from './domain/types';
import { navigate, useRoute } from './hooks/useRoute';
import { useStore } from './hooks/useStore';
import type { Database } from './storage/database';
import { trackStore } from './storage/tracks';

const TABS = [
  { path: '', label: 'Accueil', icon: '📊' },
  { path: 'journal', label: 'Journal', icon: '📒' },
  { path: 'ajouter', label: 'Ajouter', icon: '➕' },
  { path: 'plan', label: 'Plan', icon: '📅' },
  { path: 'progres', label: 'Progrès', icon: '📈' },
] as const;

export function App({ database }: { database?: Database }) {
  const store = useStore(database);
  const route = useRoute();
  const [flash, setFlash] = useState<string | null>(null);
  const [section = '', id, sub] = route.parts;

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  let title = 'APPRUN';
  let back: string | null = null;
  let content: React.ReactNode;

  switch (section) {
    case '':
      content = <Dashboard data={store.data} activities={store.activities} onPlan={(p) => (store.addPlan(p), setFlash('Séance ajoutée au plan 📅'))} />;
      break;
    case 'journal':
      title = 'Journal';
      content = <Journal activities={store.activities} />;
      break;
    case 'ajouter': {
      if (!id || !isSportId(id)) {
        title = 'Nouvelle séance';
        content = <SportPicker settings={store.data.settings} />;
        break;
      }
      const plan = store.data.plans.find((p) => p.id === route.query.get('plan'));
      const q = route.query;
      const format = q.get('format');
      const prefill = q.has('photo')
        ? takePrefill()
        : {
        title: q.get('titre') ?? undefined,
        durationSeconds: Number(q.get('duree')) || undefined,
        format: format && (WOD_FORMATS as readonly string[]).includes(format) ? (format as WodFormat) : undefined,
        score: q.get('score') ?? undefined,
          };
      title = plan ? 'Valider la séance' : 'Nouvelle séance';
      back = plan ? '/plan' : '/ajouter';
      content = (
        <ActivityForm
          key={`${id}-${plan?.id ?? ''}-${q.toString()}`}
          sport={id}
          plan={plan}
          prefill={prefill}
          onCancel={() => history.back()}
          onSubmit={(input) => {
            const a = store.addActivity(input);
            setFlash('Séance ajoutée 💪');
            navigate(`/activite/${a.id}`);
          }}
        />
      );
      break;
    }
    case 'chrono':
      title = 'Chrono';
      back = '/ajouter';
      content = <TimerView key={id ?? ''} mode={(TIMER_MODES as readonly string[]).includes(id ?? '') ? (id as TimerMode) : undefined} />;
      break;
    case 'gps':
      title = 'Enregistrement';
      back = '/ajouter';
      content = isSportId(id) ? (
        <LiveTracker
          sport={id}
          onSave={(input) => store.addActivity(input).id}
          onDone={(aid) => {
            setFlash('Séance enregistrée 🎉');
            navigate(`/activite/${aid}`);
          }}
          onCancel={() => navigate('/ajouter')}
        />
      ) : null;
      break;
    case 'activite': {
      const activity = store.data.activities.find((a) => a.id === id);
      back = '/journal';
      if (!activity) {
        content = <p className="card muted">Séance introuvable.</p>;
        break;
      }
      if (sub === 'modifier') {
        title = 'Modifier';
        back = `/activite/${activity.id}`;
        content = (
          <ActivityForm
            key={activity.id}
            sport={activity.sport}
            initial={activity}
            onCancel={() => history.back()}
            onSubmit={(input) => {
              store.updateActivity(activity.id, input);
              setFlash('Séance mise à jour.');
              navigate(`/activite/${activity.id}`);
            }}
          />
        );
      } else {
        title = 'Séance';
        content = (
          <ActivityDetail
            activity={activity}
            all={store.data.activities}
            onDelete={() => {
              if (!confirm('Supprimer cette séance ?')) return;
              store.removeActivity(activity.id);
              if (activity.hasTrack) void trackStore.remove(activity.id).catch(() => undefined);
              setFlash('Séance supprimée.');
              navigate('/journal');
            }}
          />
        );
      }
      break;
    }
    case 'programmes':
      title = 'Programmes';
      back = id ? '/programmes' : '/plan';
      content = <ProgramsView store={store} programId={id} onAdded={setFlash} />;
      break;
    case 'plan':
      title = 'Plan et objectifs';
      content = <PlanView store={store} />;
      break;
    case 'corps':
    case 'progres': {
      title = 'Progrès';
      const tab = section === 'corps' ? 'corps' : PROGRESS_TABS.some((t) => t.id === id) ? (id as ProgressTab) : 'course';
      content = <ProgressView store={store} tab={tab} />;
      break;
    }
    case 'reglages':
      title = 'Réglages';
      back = '/';
      content = <SettingsView store={store} />;
      break;
    default:
      content = <p className="card muted">Page introuvable.</p>;
  }

  const activeTab = section === 'programmes' ? 'plan' : section === 'activite' ? 'journal' : section === 'gps' || section === 'chrono' ? 'ajouter' : section === 'corps' ? 'progres' : section;

  return (
    <div className="app">
      <header className="topbar">
        {back !== null ? (
          <button className="icon-btn" aria-label="Retour" onClick={() => navigate(back!)}>
            ‹
          </button>
        ) : (
          <span className="logo" aria-hidden="true">
            🏃
          </span>
        )}
        <h1>{title}</h1>
        <button className="icon-btn" aria-label="Réglages" onClick={() => navigate('/reglages')}>
          ⚙️
        </button>
      </header>

      <main className="content">{content}</main>

      {flash && (
        <p className="toast ok floating" role="status">
          {flash}
        </p>
      )}

      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map((t) => (
          <button key={t.path} className={`tab${t.path === 'ajouter' ? ' tab-add' : ''}${activeTab === t.path ? ' active' : ''}`} aria-current={activeTab === t.path ? 'page' : undefined} onClick={() => navigate(`/${t.path}`)}>
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
