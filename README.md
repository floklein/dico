# Le jeu du Dico

MVP mobile-first multijoueur en francais avec Next.js (App Router), SSE + HTTP, et etat des parties en memoire serveur.

## Stack

- Next.js 16 + React 19
- Etat de partie en RAM (processus Node unique)
- Temps reel via SSE (`/api/rooms/[code]/events`)
- IA via Vercel AI Gateway (modele par defaut: `google/gemini-3-flash`)

## Setup local

1. Installer les dependances:

```bash
npm install
```

2. Configurer l'environnement:

```bash
cp .env.example .env.local
```

Puis renseigner au minimum:

- `VERCEL_AI_GATEWAY_API_KEY`
- `LLM_MODEL` (optionnel, defaut `google/gemini-3-flash`)

3. Lancer l'app:

```bash
npm run dev
```

App disponible sur `http://localhost:3000`.

## Scripts

- `npm run dev` lance le serveur de dev
- `npm test` lance les tests Vitest (mode CI)
- `npm run test:watch` lance les tests Vitest en mode watch
- `npm run lint` lance ESLint
- `npm run build` build production
- `npm run start` lance le build en mode prod

## Regles MVP (actuelles)

- 5 manches, min 2 joueurs, max 8
- Ecriture: 45s
- Vote: 20s
- Score: `+2` si vote correct, `+1` par vote recu sur sa definition
- Defs anonymes et melangees, auto-vote autorise
- Si pas de soumission: definition auto-generee
- Si pas de vote: 0 point
- Reconnexion joueur geree par session (`playerId` + `sessionToken`)

## IA et definitions

- Generation du mot difficile + vraie definition au debut de manche
- Normalisation batch des definitions joueurs en 1 call IA par manche (nominal):
  - correction orthographe, accents, apostrophes, casse et ponctuation
  - pas de reformulation (garde-fous serveur anti-paraphrase)
- Style de la vraie definition: court, naturel, sans point final

## Endpoints API

- `POST /api/rooms`
- `POST /api/rooms/[code]/join`
- `GET /api/rooms/[code]/snapshot`
- `GET /api/rooms/[code]/events`
- `POST /api/rooms/[code]/start`
- `POST /api/rooms/[code]/submit`
- `POST /api/rooms/[code]/vote`
- `POST /api/rooms/[code]/next-round`
- `POST /api/rooms/[code]/play-again`
- `POST /api/rooms/[code]/leave`

## Notes de deploiement

- Ce MVP suppose un seul processus Node actif.
- L'etat n'est pas persiste en base: redemarrage serveur = parties perdues.
