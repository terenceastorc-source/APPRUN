import { CATEGORIES, CATEGORY_LABELS, SPORTS, SPORT_IDS } from '../domain/sports';
import { navigate } from '../hooks/useRoute';

export function SportPicker() {
  const gpsSports = SPORT_IDS.filter((s) => SPORTS[s].gps);
  return (
    <div className="stack">
      <section className="card">
        <h2>📍 Enregistrer en direct (GPS)</h2>
        <p className="muted small">Chrono, distance, allure et carte du parcours depuis ton téléphone.</p>
        <div className="sport-grid">
          {gpsSports.map((s) => (
            <button key={s} className="sport-tile" onClick={() => navigate(`/gps/${s}`)}>
              <span aria-hidden="true">{SPORTS[s].icon}</span>
              {SPORTS[s].label}
            </button>
          ))}
        </div>
      </section>
      {CATEGORIES.map((cat) => (
        <section className="card" key={cat}>
          <h2>Saisir une séance · {CATEGORY_LABELS[cat]}</h2>
          <div className="sport-grid">
            {SPORT_IDS.filter((s) => SPORTS[s].category === cat).map((s) => (
              <button key={s} className="sport-tile" onClick={() => navigate(`/ajouter/${s}`)}>
                <span aria-hidden="true">{SPORTS[s].icon}</span>
                {SPORTS[s].label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
