# APPRUN 🏃

Application web mobile (PWA) de **suivi de courses à pied** : enregistre tes sorties, suis ton kilométrage, ton allure, tes records et ton objectif hebdomadaire. Fonctionne hors ligne et s'installe sur l'écran d'accueil du téléphone.

## Fonctionnalités

- **Saisie d'une sortie** : date, type (footing, fractionné, sortie longue, tempo, compétition, trail), distance, durée, ressenti (1–5), FC moyenne, dénivelé, notes. Allure et vitesse calculées en direct.
- **Tableau de bord** : totaux semaine / mois / année / global, objectif hebdomadaire avec barre de progression, série de semaines actives, histogramme du kilométrage sur 12 semaines.
- **Records** : meilleurs temps sur 5 km, 10 km, semi et marathon (tolérance GPS ±2 %), plus longue sortie, meilleure allure.
- **Historique** : regroupé par mois, filtre par type, recherche dans les notes, modification et suppression.
- **Données** : stockées localement sur l'appareil ; export JSON / CSV (compatible Excel), import JSON, effacement.
- **PWA** : installable, hors ligne, thème clair/sombre automatique.

## Démarrer

```bash
npm install
npm run dev        # serveur de développement
npm test           # tests unitaires et d'intégration (Vitest)
npm run build      # vérification des types + build de production dans dist/
npm run preview    # sert le build (service worker actif)
```

Pour l'installer sur un téléphone, déploie le dossier `dist/` sur un hébergement HTTPS (GitHub Pages, Netlify…) puis utilise « Ajouter à l'écran d'accueil ».

## Architecture

```
src/
  domain/       Logique métier pure, sans React (formats, statistiques, validation)
  storage/      Persistance localStorage versionnée + import/export
  hooks/        useRunStore : relie le dépôt à l'état React
  components/   Écrans : Dashboard, RunForm, RunList, SettingsPanel, WeeklyChart (SVG)
  App.tsx       Navigation par onglets (hash, compatible bouton retour)
public/         Manifest, service worker, icônes
```

Choix techniques :
- **React + TypeScript strict + Vite**, aucune dépendance d'exécution hormis React.
- Distances en **mètres** et durées en **secondes** (entiers) pour éviter les erreurs d'arrondi ; dates stockées en `AAAA-MM-JJ` local pour éviter les décalages de fuseau.
- Le dépôt (`RunRepository`) reçoit son stockage, son horloge et son générateur d'id par injection : il est testé sans navigateur.
- Schéma de stockage versionné (`version: 1`) avec un point de migration prévu ; les données corrompues ou invalides sont ignorées sans faire planter l'app.
- CI GitHub Actions : typecheck, tests, build.
