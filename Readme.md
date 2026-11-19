# APPRUN 🏃🏋️🔥

👉 **Application en ligne : https://terenceastorc-source.github.io/APPRUN/**

Application web mobile (PWA) de **suivi complet des activités sportives** : endurance, CrossFit, HYROX et ATH X. Elle fonctionne hors ligne et s'installe sur l'écran d'accueil du téléphone. Les données restent sur l'appareil.

## Fonctionnalités

| Module | Contenu |
|---|---|
| **Sports** | Course à pied, trail, vélo, natation, marche, randonnée, CrossFit, HYROX, ATH X |
| **Saisie adaptée au sport** | Endurance : distance, D+, type de sortie, allure ou vitesse calculée (min/km, km/h, min/100 m). CrossFit : format (For Time, AMRAP, EMOM…), RX/Scaled, benchmark, score, exercices de force avec 1RM estimé. HYROX / ATH X : course officielle ou entraînement, division, classement, temps par segment (modèle HYROX 8 × 1 km + 8 ateliers). |
| **GPS en direct** | Chrono, distance, allure moyenne et instantanée, carte OpenStreetMap, temps au km, pause/reprise, écran maintenu allumé, reprise après rechargement |
| **Tableau de bord** | Bilan de la semaine, charge d'entraînement (sRPE) avec ratio aiguë/chronique, temps par semaine et par catégorie, répartition par sport, records (course, HYROX/ATH X, benchmarks CrossFit, charges max) |
| **Chronos** | For Time (time cap, compteur de tours), AMRAP, EMOM, Tabata, intervalles : bips 3-2-1, vibrations, écran allumé, résultat enregistré en séance |
| **Programmes** | 10 km (8 sem.), semi-marathon (10 sem.), préparation HYROX (8 sem.), base CrossFit (6 sem.) ; 3 niveaux ; calés sur la date de course ; suivi de l'avancement |
| **Progrès** | Prédictions 5 km → marathon (Riegel), km et allure par mois, zones cardiaques ; progression par benchmark et 1RM estimé ; HYROX/ATH X : temps total et atelier à travailler |
| **Plan** | Calendrier mensuel, séances planifiées, validation « Fait ✓ » qui pré-remplit la séance, objectifs par sport/catégorie (km, heures, séances, charge) par semaine/mois/année |
| **Corps** | Poids, sommeil, FC au repos, forme ressentie, courbes sur 30 jours / 3 mois / 1 an |
| **Données** | Sauvegarde complète JSON (traces GPS incluses), export CSV, import, migration automatique des données de la v1 |

## Démarrer

```bash
npm install
npm run dev        # serveur de développement
npm test           # tests unitaires et d'intégration (Vitest)
npm run build      # vérification des types + build de production dans dist/
npm run preview    # sert le build (service worker actif)
```

Déploiement automatique sur GitHub Pages à chaque push sur `main` (`.github/workflows/deploy.yml`).

## Architecture

```
src/
  domain/       Logique métier pure, testée sans navigateur
    sports.ts     Catalogue des sports et catégories
    types.ts      Modèle de données (activités, corps, objectifs, plan)
    load.ts       Charge sRPE, ratio aiguë/chronique
    stats.ts      Agrégats par période, catégorie, sport
    goals.ts      Progression des objectifs
    records.ts    Records course, HYROX/ATH X, benchmarks, charges
    hyrox.ts      Modèle de course HYROX
    geo.ts        Haversine, filtrage GPS, splits, D+
    recorder.ts   Machine à états de l'enregistrement GPS
    validation.ts Règles de saisie
    timer.ts      Moteur des chronos (phases, pause)
    analytics.ts  Prédictions, zones FC, historiques de progression
    programs.ts   Catalogue et planification des programmes
  storage/
    database.ts   Document JSON versionné (localStorage) + migrations
    tracks.ts     Traces GPS (IndexedDB)
    exchange.ts   Import / export
  hooks/        useStore (état React), useRoute (navigation par hash)
  components/   Écrans et graphiques SVG
```

Choix techniques :
- **React + TypeScript strict + Vite**. Leaflet est la seule dépendance ajoutée ; il est chargé à la demande, seulement quand une carte s'affiche.
- Distances en mètres et durées en secondes (entiers), dates locales `AAAA-MM-JJ` : pas d'erreur d'arrondi ni de décalage de fuseau.
- **Charge d'entraînement sRPE** (durée × effort perçu 1–10) : une même mesure pour comparer course, CrossFit et HYROX.
- Schéma versionné (`version: 2`) avec migration depuis la v1 (course seule). Les données invalides sont ignorées sans bloquer l'app.
- GPS : filtrage des points imprécis, du bruit à l'arrêt et des sauts irréalistes ; la session en cours est sauvegardée pour survivre à un rechargement.
- Graphiques en SVG maison : palette catégorielle validée pour le daltonisme (clair et sombre), légende, infobulles au survol ou au toucher.

## Limites connues

- Sur téléphone, le navigateur coupe le GPS quand l'écran est verrouillé : l'app demande à garder l'écran allumé (Wake Lock).
- Les données sont locales à l'appareil : penser à la sauvegarde JSON.
- Prévu : synchronisation automatique Garmin via Strava (nécessite un petit serveur pour l'authentification).
