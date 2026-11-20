# Serveur IA d'APPRUN

Petit serveur (Cloudflare Worker) qui fait le lien entre l'application et l'API de Claude :

| Route | Rôle |
|---|---|
| `POST /wod-photo` | Lit la photo d'un tableau de WOD et renvoie la séance structurée (format, benchmark, contenu, exercices de force) |
| `POST /coach` | Reçoit un résumé de tes 14 derniers jours (séances, charge, mesures, plan, objectifs) et renvoie la séance recommandée du jour |

Pourquoi un serveur ? La clé API Anthropic ne doit jamais se trouver dans une page web publique : n'importe qui pourrait la lire et l'utiliser à tes frais. Elle reste ici, côté serveur, en secret.

Modèle utilisé : **Claude Opus 5.5** (`claude-opus-5-5`), en sortie structurée (le JSON respecte toujours le schéma attendu), avec repli automatique sur un autre modèle si une demande est refusée par les filtres de sécurité.

## Déployer (≈ 10 minutes, gratuit côté Cloudflare)

Prérequis : un ordinateur avec Node.js 22, un compte [Cloudflare](https://dash.cloudflare.com/sign-up) (gratuit) et une clé API Anthropic ([console.anthropic.com](https://console.anthropic.com) → API Keys).

```bash
cd server
npm install
npx wrangler login                      # ouvre le navigateur pour connecter ton compte Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY   # colle ta clé Anthropic quand c'est demandé
npx wrangler secret put ACCESS_CODE         # invente un code long (ex. 20 caractères aléatoires)
npx wrangler deploy
```

La dernière commande affiche l'adresse du serveur, du type `https://apprun-ai.<ton-compte>.workers.dev`.

Puis dans l'application : **Réglages ⚙️ → Coach IA** → colle l'adresse et le code d'accès → **Tester la connexion** (ne consomme rien) → **Enregistrer**.

Si l'application est servie depuis une autre adresse que `https://terenceastorc-source.github.io`, ajoute-la dans `ALLOWED_ORIGINS` (`wrangler.toml`) et redéploie.

## Sécurité

- **Code d'accès** : chaque requête doit porter le code (`X-Apprun-Code`), comparé en temps constant. Sans lui, le serveur refuse avant tout appel à Claude. Garde-le pour toi ; change-le avec `wrangler secret put ACCESS_CODE` si besoin (puis mets-le à jour dans l'app).
- **Limite de dépenses** : fixe une limite mensuelle dans la console Anthropic (Settings → Limits). C'est la vraie protection contre une facture imprévue.
- **Données envoyées** : la photo (réduite sur le téléphone à 1568 px, ~50–300 Ko), ou pour le coach un résumé de 14 jours de séances, 7 jours de mesures et 7 jours de plan. Ni ton historique complet, ni le code d'accès, ni tes traces GPS. Le serveur ne stocke rien.
- **Limites** : image ≤ 5 Mo, contexte ≤ 200 Ko, message ≤ 1 000 caractères.

## Coût

Estimation (non mesurée) aux tarifs de Claude Opus 5.5 (4 $ / million de jetons en entrée, 20 $ en sortie) : de l'ordre de **quelques centimes par photo ou par conseil**. Le conseil du coach est gardé en mémoire pour la journée sur le téléphone : rouvrir l'app ne le redemande pas. Le Worker Cloudflare est gratuit jusqu'à 100 000 requêtes par jour.

## Développer

```bash
npm run typecheck              # vérification des types
npx vitest run server          # tests (depuis la racine du dépôt)
npx wrangler dev               # serveur local sur http://localhost:8787
```

Pour `wrangler dev`, crée un fichier `server/.dev.vars` (ignoré par git) :

```
ANTHROPIC_API_KEY=sk-ant-...
ACCESS_CODE=dev
```

Les consignes données à Claude sont dans `src/prompts.ts` ; les schémas de réponse, partagés avec l'application, dans `../src/ai/contract.ts`.
