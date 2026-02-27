# Le jeu du Dico

Jeu multijoueur mobile-first, construit avec Next.js (App Router), API HTTP + SSE, et état de partie en mémoire serveur.

## Fonctionnalités

- Création/rejoindre un salon par code (`4` lettres)
- Reconnexion par session locale (`playerId` + `sessionToken`)
- Flux temps réel via Server-Sent Events
- Manches avec mot/définition correcte générés par IA
- Normalisation des définitions joueurs en batch (orthographe/ponctuation) avec garde-fous anti-paraphrase

## Stack technique

- Next.js `16` + React `19`
- État des salons en RAM (process Node unique)
- SSE sur `GET /api/rooms/[code]/events`
- Vercel AI Gateway (modèle par défaut : `openai/gpt-5.2`)
- Vitest pour la logique de jeu serveur

## Setup local

1. Installer les dépendances.

```bash
npm install
```

2. Configurer l'environnement.

```bash
cp .env.example .env.local
```

Variables :

- `VERCEL_AI_GATEWAY_API_KEY` (requis)
- `LLM_MODEL` (optionnel, défaut : `openai/gpt-5.2`)

3. Lancer en local.

```bash
npm run dev
```

Application disponible sur `http://localhost:3000`.

## Scripts

- `npm run dev` démarre le serveur de dev
- `npm run build` build de production
- `npm run start` démarre le build de production
- `npm run lint` lance ESLint
- `npm test` lance Vitest en mode CI
- `npm run test:watch` lance Vitest en mode watch

## Règles de jeu (actuelles dans le code)

- 5 manches par partie
- 2 joueurs minimum, 8 maximum
- Phase écriture : `60s`
- Phase vote : `30s`
- `+2` points pour un vote sur la vraie définition
- `+1` point par vote reçu sur sa définition
- Auto-vote interdit
- Si un joueur ne soumet rien : fausse définition auto-générée
- Si un joueur ne vote pas : aucun point
- Le passage à la manche suivante est déclenché par l'hôte (`next-round`)

## Contrat API (résumé)

Toutes les réponses API utilisent le format :

- succès : `{ "ok": true, "data": ... }`
- erreur : `{ "ok": false, "error": "..." }`

Endpoints :

- `POST /api/rooms`
  - body : `{ "playerName": string }`
- `POST /api/rooms/[code]/join`
  - body : `{ "playerName": string, "playerId"?: string, "sessionToken"?: string }`
- `GET /api/rooms/[code]/snapshot?playerId=...`
- `GET /api/rooms/[code]/events?playerId=...`
- `POST /api/rooms/[code]/start`
  - body : `{ "playerId": string, "sessionToken": string }`
- `POST /api/rooms/[code]/submit`
  - body : `{ "playerId": string, "sessionToken": string, "definition": string }`
- `POST /api/rooms/[code]/vote`
  - body : `{ "playerId": string, "sessionToken": string, "optionId": string }`
- `POST /api/rooms/[code]/next-round`
  - body : `{ "playerId": string, "sessionToken": string }`
- `POST /api/rooms/[code]/play-again`
  - body : `{ "playerId": string, "sessionToken": string }`
- `POST /api/rooms/[code]/leave`
  - body : `{ "playerId": string, "sessionToken": string }`

## Limites actuelles

- État en mémoire uniquement : redémarrage serveur = salons perdus
- Aucune persistance en base de données
- Conçu pour une seule instance serveur (pas de scaling horizontal sans store partagé)
