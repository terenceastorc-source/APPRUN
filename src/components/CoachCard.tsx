import { useState } from 'react';
import { AiError, aiConfigured, aiRequest } from '../ai/client';
import { buildCoachContext } from '../ai/coachContext';
import { isCoachAdvice, type CoachAdvice } from '../ai/contract';
import { toIsoDate } from '../domain/format';
import { SPORTS } from '../domain/sports';
import type { AppData, PlannedSession } from '../domain/types';
import { navigate } from '../hooks/useRoute';
import { Card } from './ui';

const CACHE_KEY = 'apprun:coach';
const STATUS = {
  go: { label: 'Feu vert', className: 'status-optimal' },
  adapt: { label: 'Séance adaptée', className: 'status-eleve' },
  rest: { label: 'Récupération', className: 'status-insuffisant' },
} as const;

interface Cached {
  date: string;
  note: string;
  advice: CoachAdvice;
}

function readCache(today: string): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null;
    return c && c.date === today && isCoachAdvice(c.advice) ? c : null;
  } catch {
    return null;
  }
}

interface Props {
  data: AppData;
  onPlan(plan: Omit<PlannedSession, 'id'>): void;
  today?: Date;
}

export function CoachCard({ data, onPlan, today = new Date() }: Props) {
  const todayIso = toIsoDate(today);
  const [cached, setCached] = useState<Cached | null>(() => readCache(todayIso));
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(!cached);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planned, setPlanned] = useState(false);

  if (!aiConfigured(data.settings)) {
    return (
      <Card title="🧠 Coach du jour">
        <p className="muted small">
          Un coach IA qui lit ta charge, ton sommeil, ta forme et ton plan, puis te propose la bonne séance du jour. Il faut d'abord brancher le serveur IA dans les{' '}
          <button className="link" onClick={() => navigate('/reglages')}>
            réglages
          </button>
          .
        </p>
      </Card>
    );
  }

  async function ask() {
    setLoading(true);
    setError(null);
    try {
      const advice = await aiRequest(data.settings, '/coach', { context: buildCoachContext(data, today), note }, isCoachAdvice);
      const c = { date: todayIso, note, advice };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(c));
      } catch {
        /* pas de cache : on garde seulement en mémoire */
      }
      setCached(c);
      setAsking(false);
      setPlanned(false);
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Le coach est indisponible pour le moment.');
    } finally {
      setLoading(false);
    }
  }

  const advice = cached?.advice;
  return (
    <Card title="🧠 Coach du jour" action={advice && !asking && <span className={`status ${STATUS[advice.status].className}`}>{STATUS[advice.status].label}</span>}>
      {advice && !asking ? (
        <div className="coach">
          <p className="coach-headline">{advice.headline}</p>
          <p className="small">{advice.analysis}</p>
          <div className="coach-session">
            <div className="row-between">
              <strong>
                {SPORTS[advice.session.sport].icon} {advice.session.title}
              </strong>
              <span className="muted small">
                {advice.session.durationMinutes} min · {advice.session.intensity}
              </span>
            </div>
            <p className="small notes">{advice.session.description}</p>
          </div>
          {advice.tips.length > 0 && (
            <ul className="coach-tips">
              {advice.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          <div className="actions">
            <button className="btn ghost small" onClick={() => (setAsking(true), setNote(cached?.note ?? ''))}>
              Redemander
            </button>
            <button
              className="btn primary small"
              disabled={planned}
              onClick={() => {
                onPlan({
                  date: todayIso,
                  sport: advice.session.sport,
                  title: advice.session.title,
                  description: `Coach : ${advice.session.description}`,
                  targetDurationMin: advice.session.durationMinutes,
                });
                setPlanned(true);
              }}
            >
              {planned ? 'Ajoutée au plan ✓' : 'Ajouter à mon plan'}
            </button>
          </div>
          <p className="muted small hint">Conseil généré par IA à partir de tes données : écoute ton corps, et consulte un professionnel en cas de douleur.</p>
        </div>
      ) : (
        <div className="form">
          <p className="muted small">Le coach analyse tes 14 derniers jours, ta récupération et ton plan pour te proposer la séance du jour.</p>
          <label>
            Ton contexte aujourd'hui (optionnel)
            <textarea rows={2} placeholder="Ex. 40 min dispo, mollet un peu raide, envie de courir" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            {advice && (
              <button className="btn ghost small" onClick={() => setAsking(false)}>
                Annuler
              </button>
            )}
            <button className="btn primary" onClick={ask} disabled={loading}>
              {loading ? '⏳ Le coach réfléchit…' : 'Demander au coach'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
