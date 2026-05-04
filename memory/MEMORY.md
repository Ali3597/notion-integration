# Project Memory

## Stack
- **DB**: PostgreSQL local, database `lifehub`, port 5432
- **ORM**: Drizzle ORM (`lib/schema.ts`, `lib/db.ts`, `drizzle.config.ts`)
- **Auth**: NextAuth.js v5 beta (Google OAuth, allowed: a64397573@gmail.com)
- **Next.js**: 15.2.x — DO NOT upgrade to 15.3.x (breaks next-auth beta)
- **psql path**: `/opt/homebrew/opt/postgresql@16/bin/`

## Key Files
- `lib/schema.ts` — Drizzle tables: projects, tasks, sessions, meditations, shopping_items, reminders, project_relations, authors, genres, series, books, book_notes, habits, habit_logs, journal_entries, journal_logs, birthdays, dnd_* tables, planning_blocks, finance_* tables, recipe_categories, recipes, recipe_ingredients
- `lib/db.ts` — PostgreSQL pool + drizzle instance
- `lib/petitbambou.ts` — PB API client + computeStreaks()
- `drizzle.config.ts` — drizzle-kit config
- `scripts/setup.sh` — creates DB + pushes schema

## Modules supprimés (2026-03-30)
- **Poids** (`/weight`, `/api/weight/`, `weight_entries` table) — supprimé
- **Santé/Garmin** (`/health`, `/api/health/`, `garmin_*` tables) — supprimé
- **Chess** (`/chess`, `/api/chess/`, `chess_*` tables, `lib/chess.ts`) — supprimé
- Package `garmin-connect` désinstallé
- Variables d'env `GARMIN_EMAIL`, `GARMIN_PASSWORD`, `CHESS_USERNAME` supprimées

## ENV actuel
- `DATABASE_URL=postgresql://localhost:5432/lifehub`
- `PB_USER_UUID`, `PB_AUTH_TOKEN`
- Auth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `ICAL_URL` — iCloud calendar
- `GOOGLE_BOOKS_API_KEY` — bibliothèque

## DB Commands
```bash
DATABASE_URL=postgresql://localhost:5432/lifehub npm run db:migrate
npm run db:studio
bash scripts/setup.sh
```

## Conventions
- CSS custom properties from globals.css only (no new style systems)
- Inline React.CSSProperties for layout
- Timer saves only when interval ends naturally with a task selected
