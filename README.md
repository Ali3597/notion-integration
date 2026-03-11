# life×hub

Plateforme de productivité locale. Centralise tes outils en un seul endroit avec une base PostgreSQL locale — aucune dépendance cloud.

## Intégrations disponibles

| Intégration | Route | Description |
|-------------|-------|-------------|
| Pomodoro | `/pomodoro` | Sessions de travail chronométrées liées aux projets et tâches |
| Projets | `/projects` | Vue tableau de tous tes projets avec stats de sessions |
| Tâches | `/tasks` | Toutes les tâches filtrables par statut, priorité et projet |
| Petit Bambou | `/petitbambou` | Sync des sessions de méditation depuis l'app PB, avec streaks, calendrier et stats |
| Shopping | `/shopping` | Wishlist et liste de courses avec suivi du budget |
| Chess.com | `/chess` | Suivi de progression, ouvertures et records depuis Chess.com |

## Stack

- **Next.js 15.2.x** + TypeScript
- **PostgreSQL** local (Homebrew `postgresql@16`)
- **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`)
- **NextAuth.js v5 beta** — Google OAuth (whitelist `a64397573@gmail.com`)

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Créer la base de données et pousser le schéma
bash scripts/setup.sh

# 3. Lancer le serveur de développement
npm run dev   # http://localhost:3000
```

> **Prérequis** : PostgreSQL 16 installé via Homebrew (`brew install postgresql@16`), service démarré (`brew services start postgresql@16`).

## Configuration

Crée un fichier `.env.local` à la racine :

```
# Base de données locale
DATABASE_URL=postgresql://localhost:5432/lifehub

# Petit Bambou (optionnel)
PB_USER_UUID=<uuid utilisateur PB>
PB_AUTH_TOKEN=<token JWT issu de l'app mobile PB>

# Chess.com / Notion (optionnel)
NOTION_TOKEN=secret_...
NOTION_CHESS_GAMES_DB=<database_id>
NOTION_CHESS_OPENINGS_DB=<database_id>
NOTION_CHESS_RECORDS_DB=<database_id>

# Auth (NextAuth.js v5 — Google OAuth)
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<Google Cloud Console>
GOOGLE_CLIENT_SECRET=<Google Cloud Console>
```

## Schéma de la base

| Table | Colonnes principales |
|-------|---------------------|
| `projects` | id, name, status, type |
| `tasks` | id, name, status, priority, project_id |
| `sessions` | id, name, task_id, start_time, end_time, notes |
| `meditations` | id, lesson, date, duration_min, pb_uuid, streak |
| `shopping_items` | id, name, category, estimated_price, purchased, store_link, notes |

Pour modifier le schéma, éditer `lib/schema.ts` puis relancer `npx drizzle-kit push`.

## Ajouter une nouvelle intégration

1. Page : `app/<nom>/page.tsx`
2. Routes API : `app/api/<nom>/route.ts`
3. Types : ajouter dans `types/index.ts` si nécessaire
4. Carte hub : ajouter une entrée dans le tableau `integrations` de `app/page.tsx`
5. Schéma DB : ajouter la table dans `lib/schema.ts` + `npx drizzle-kit push`

## Contraintes techniques

- **Next.js doit rester sur `15.2.x`** — les versions 15.3+ cassent `next-auth@beta`
- Pas de linter ni de test runner configurés
- Authentification Google restreinte à `a64397573@gmail.com` (`auth.ts`)
- L'app est **local-only** — aucun déploiement cloud prévu
