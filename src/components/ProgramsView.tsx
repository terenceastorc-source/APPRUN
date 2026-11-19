import { useMemo, useState } from 'react';
import { formatDate, formatHours, toIsoDate } from '../domain/format';
import { LEVELS, LEVEL_LABELS, PROGRAMS, activePrograms, programById, scheduleProgram, type Level, type ProgramDef } from '../domain/programs';
import { SPORTS } from '../domain/sports';
import { navigate } from '../hooks/useRoute';
import type { Store } from '../hooks/useStore';
import { ProgressBar } from './charts';
import { Card, Empty, FieldError } from './ui';

function newInstanceId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `prog-${Date.now().toString(36)}`;
}

/** Programmes en cours (affichés aussi dans l'onglet Plan). */
export function ActivePrograms({ store, today = new Date() }: { store: Store; today?: Date }) {
  const list = activePrograms(store.data.plans, toIsoDate(today));
  return (
    <Card
      title="Programmes"
      action={
        <button className="btn small primary" onClick={() => navigate('/programmes')}>
          {list.length ? '+ Programme' : 'Choisir un programme'}
        </button>
      }
    >
      {list.length === 0 ? (
        <Empty>Suis un programme prêt à l'emploi (10 km, semi, HYROX, CrossFit) : ses séances arrivent directement dans ton calendrier.</Empty>
      ) : (
        <ul className="goal-list">
          {list.map((p) => (
            <li key={p.instanceId}>
              <div className="row-between">
                <strong>{p.name}</strong>
                <span className="small muted">
                  {p.done}/{p.total}
                </span>
              </div>
              <ProgressBar ratio={p.done / p.total} label={`Avancement ${p.name}`} />
              <p className="muted small">
                Du {formatDate(p.start)} au {formatDate(p.end)}
                {p.missed > 0 && ` · ${p.missed} séance${p.missed > 1 ? 's' : ''} manquée${p.missed > 1 ? 's' : ''}`}
                {p.next && (
                  <>
                    <br />
                    Prochaine : {SPORTS[p.next.sport].icon} {p.next.title} · {formatDate(p.next.date)}
                  </>
                )}
              </p>
              <button
                className="btn small danger"
                onClick={() => {
                  if (confirm(`Arrêter « ${p.name} » ? Les séances à venir seront retirées du calendrier, les séances réalisées sont conservées.`)) store.removeProgram(p.instanceId);
                }}
              >
                Arrêter le programme
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ProgramsView({ store, programId, today = new Date(), onAdded }: { store: Store; programId?: string; today?: Date; onAdded?(message: string): void }) {
  const def = programId ? programById(programId) : undefined;
  if (def) return <ProgramSetup key={def.id} def={def} store={store} today={today} onAdded={onAdded} />;
  return (
    <div className="stack">
      {PROGRAMS.map((p) => (
        <button key={p.id} className="program-card" onClick={() => navigate(`/programmes/${p.id}`)}>
          <span className="program-icon" aria-hidden="true">
            {p.icon}
          </span>
          <span className="activity-body">
            <strong>{p.name}</strong>
            <span className="muted small">{p.weeks} semaines</span>
            <span className="small">{p.summary}</span>
          </span>
        </button>
      ))}
      <p className="muted small center">Les programmes sont des bases générales : adapte-les à tes sensations, et consulte un professionnel en cas de douleur.</p>
    </div>
  );
}

function ProgramSetup({ def, store, today, onAdded }: { def: ProgramDef; store: Store; today: Date; onAdded?(message: string): void }) {
  const [level, setLevel] = useState<Level>('intermediaire');
  const [withRace, setWithRace] = useState(!!def.raceSport);
  const [raceDate, setRaceDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openWeek, setOpenWeek] = useState<number | null>(0);
  const weeks = useMemo(() => def.build(level), [def, level]);
  const instanceId = useMemo(newInstanceId, []);

  const preview = withRace && !raceDate ? null : scheduleProgram(def, level, { raceDate: withRace ? raceDate : undefined, today, instanceId });

  function add() {
    if (withRace && !raceDate) return setError('Choisis la date de ta course.');
    if (!preview) return;
    if ('error' in preview) return setError(preview.error);
    const n = store.addPlans(preview.sessions);
    onAdded?.(`${n} séances ajoutées au calendrier 📅`);
    navigate('/plan');
  }

  return (
    <div className="stack">
      <Card title={`${def.icon} ${def.name}`}>
        <p className="small">{def.summary}</p>
        <div className="segmented" role="group" aria-label="Niveau">
          {LEVELS.map((l) => (
            <button key={l} className={level === l ? 'active' : ''} aria-pressed={level === l} onClick={() => setLevel(l)}>
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Calendrier">
        {def.raceSport && (
          <label className="check">
            <input type="checkbox" checked={withRace} onChange={(e) => setWithRace(e.target.checked)} /> J'ai une date de course
          </label>
        )}
        {withRace ? (
          <label>
            Date de la course
            <input type="date" min={toIsoDate(today)} value={raceDate} onChange={(e) => (setRaceDate(e.target.value), setError(null))} aria-invalid={!!error} />
          </label>
        ) : (
          <p className="muted small">Le programme démarre lundi prochain.</p>
        )}
        {preview && !('error' in preview) && (
          <p className="pace-preview">
            {preview.sessions.length} séances, du <strong>{formatDate(preview.start)}</strong> au <strong>{formatDate(preview.sessions[preview.sessions.length - 1]!.date)}</strong>.
          </p>
        )}
        <FieldError message={error ?? (preview && 'error' in preview ? preview.error : undefined)} />
        <div className="actions">
          <button className="btn ghost" onClick={() => navigate('/programmes')}>
            Retour
          </button>
          <button className="btn primary" onClick={add}>
            Ajouter au calendrier
          </button>
        </div>
      </Card>

      <Card title="Contenu semaine par semaine">
        <ul className="week-list">
          {weeks.map((week, w) => {
            const minutes = week.reduce((s, x) => s + (x.durationMin ?? (x.distanceKm ? x.distanceKm * 6 : 0)), 0);
            return (
              <li key={w}>
                <button className="week-head" aria-expanded={openWeek === w} onClick={() => setOpenWeek(openWeek === w ? null : w)}>
                  <strong>Semaine {w + 1}</strong>
                  <span className="muted small">
                    {week.length} séances · ~{formatHours(minutes * 60)}
                  </span>
                  <span aria-hidden="true">{openWeek === w ? '▾' : '▸'}</span>
                </button>
                {openWeek === w && (
                  <ul className="plan-list">
                    {week.map((s, i) => (
                      <li key={i}>
                        <span aria-hidden="true">{SPORTS[s.sport].icon}</span>
                        <span className="grow">
                          <strong>{s.title}</strong>
                          <span className="muted small">
                            {' '}
                            · {['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'][s.day]}
                            {s.durationMin ? ` · ${s.durationMin} min` : ''}
                            {s.distanceKm ? ` · ${String(s.distanceKm).replace('.', ',')} km` : ''}
                          </span>
                          <span className="small notes">{s.description}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
