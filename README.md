# notion×hub

Plateforme d'intégrations Notion. Connecte tes outils et apps favoris à Notion pour lire et pousser des données automatiquement.

## Intégrations disponibles

| Intégration | Route | Description |
|-------------|-------|-------------|
| Pomodoro | `/pomodoro` | Sessions de travail chronométrées liées aux projets et tâches Notion |
| Petit Bambou | `/petitbambou` | Sync des sessions de méditation vers Notion, avec calcul de streaks et mise à jour d'une page Stats |

## Installation

```bash
npm install
```

## Configuration

Crée un fichier `.env.local` à la racine :

```
# Notion
NOTION_TOKEN=secret_...

# Pomodoro
NOTION_PROJECTS_DB=<database_id>
NOTION_TASKS_DB=<database_id>
NOTION_SESSIONS_DB=<database_id>

# Petit Bambou
NOTION_MEDITATIONS_DB=<database_id>   # créé automatiquement au premier lancement
NOTION_STATS_PAGE_ID=<page_id>        # page Notion avec 4 callouts de stats (optionnel)
PB_USER_UUID=<uuid utilisateur PB>
PB_AUTH_TOKEN=<token JWT PB>

# Auth (NextAuth.js v5 — Google OAuth)
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<Google Cloud Console>
GOOGLE_CLIENT_SECRET=<Google Cloud Console>
```

> **Contrainte version** : Next.js doit rester sur `15.2.x`. Les versions 15.3+ cassent `next-auth@beta`.

## Développement

```bash
npm run dev   # http://localhost:3000
```

## Déploiement (Vercel)

URL de production : `https://notion-integration-teal.vercel.app`

1. Push sur `main` → déploiement automatique via GitHub
2. Variables d'environnement à configurer dans Vercel (Settings → Environment Variables) :
   `NOTION_TOKEN`, `NOTION_PROJECTS_DB`, `NOTION_TASKS_DB`, `NOTION_SESSIONS_DB`,
   `NOTION_MEDITATIONS_DB`, `NOTION_STATS_PAGE_ID`, `PB_USER_UUID`, `PB_AUTH_TOKEN`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (URL de prod), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Ajouter une nouvelle intégration

1. Crée la page : `app/<nom>/page.tsx`
2. Crée les routes API : `app/api/<nom>/route.ts` (import depuis `@/lib/notion`)
3. Ajoute les types dans `types/index.ts`
4. Référence l'intégration dans le tableau de `app/page.tsx`
5. Ajoute les variables d'env dans `.env.local` et `lib/notion.ts`

## Contraintes techniques

- **Next.js doit rester sur `15.2.x`** — les versions 15.3+ cassent `next-auth@beta`
- Pas de linter ni de test runner configurés
- Authentification Google restreinte à `a64397573@gmail.com` (`auth.ts`)
