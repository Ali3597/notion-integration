# life×hub

Plateforme de productivité locale. Centralise tes outils en un seul endroit avec une base PostgreSQL locale — aucune dépendance cloud.

## Modules

| Module | Route | Description |
|--------|-------|-------------|
| Pomodoro | `/pomodoro` | Sessions de travail chronométrées liées aux projets et tâches |
| Projets | `/projects` | Vue tableau de tous tes projets avec stats de sessions agrégées |
| Tâches | `/tasks` | Toutes les tâches filtrables par statut, priorité et projet |
| Rappels | `/reminders` | Rappels du quotidien avec date limite, badges En retard / Aujourd'hui |
| Petit Bambou | `/petitbambou` | Sync des sessions de méditation depuis l'app PB, streaks, calendrier et stats |
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

```env
# Base de données locale
DATABASE_URL=postgresql://localhost:5432/lifehub

# Petit Bambou (optionnel)
PB_USER_UUID=<uuid utilisateur PB>
PB_AUTH_TOKEN=<token JWT issu de l'app mobile PB>

# Chess.com / Notion (optionnel)
NOTION_TOKEN=secret_...
CHESS_USERNAME=<chess.com username>
NOTION_CHESS_PARENT_PAGE_ID=<page_id>
NOTION_CHESS_RATING_DB=<db_id>
NOTION_CHESS_OPENINGS_DB=<db_id>
NOTION_CHESS_DAILY_DB=<db_id>
NOTION_CHESS_PUZZLES_DB=<db_id>
NOTION_CHESS_FORMATS_DB=<db_id>

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
| `reminders` | id, name, due_date, done, created_at |
| `project_relations` | parent_id, child_id |

Pour modifier le schéma : éditer `lib/schema.ts` puis `npm run db:migrate`.

## Commandes utiles

```bash
npm run dev          # Serveur de dev — http://localhost:3000
npm run build        # Build de production
npm run db:migrate   # Pousser le schéma Drizzle vers PostgreSQL
npm run db:studio    # Ouvrir Drizzle Studio (UI base de données)
bash scripts/setup.sh  # Premier lancement : crée la DB + pousse le schéma
```

## Conventions UI

- Styles via CSS custom properties de `globals.css` uniquement (`--bg`, `--surface`, `--accent`, etc.)
- Inline `React.CSSProperties` pour le layout — pas de librairie UI
- Filtres directement dans les en-têtes de colonnes des tableaux (clic sur colonne = dropdown inline)
- Bouton `← Accueil` (`className="btn-back"`) présent sur chaque module
- Hover des boutons principaux défini dans `globals.css` (`.btn-primary`, `.btn-back`)

## Ajouter un nouveau module

1. **Schéma** : ajouter la table dans `lib/schema.ts` + `npm run db:migrate`
2. **API** : `app/api/<nom>/route.ts` — importer `db` depuis `@/lib/db`, tables depuis `@/lib/schema`
3. **Page** : `app/<nom>/page.tsx` — inclure `<Link href="/" className="btn-back">← Accueil</Link>`
4. **Types** : ajouter dans `types/index.ts` si nécessaire
5. **Hub** : ajouter une entrée dans le tableau `integrations` de `app/page.tsx`
6. **Overview** : mettre à jour `/api/overview/route.ts` si des stats doivent apparaître sur la home

## Contraintes techniques

- **Next.js doit rester sur `15.2.x`** — les versions 15.3+ cassent `next-auth@beta`
- Pas de linter ni de test runner configurés
- Authentification Google restreinte à `a64397573@gmail.com` (`auth.ts`)
- L'app est **local-only** — aucun déploiement cloud prévu
- `@notionhq/client` est conservé uniquement pour le module Chess (`lib/notion-client.ts`)
