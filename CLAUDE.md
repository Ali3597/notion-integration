# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run start        # Start production server
npm run db:migrate   # Push Drizzle schema to PostgreSQL (drizzle-kit push)
npm run db:studio    # Open Drizzle Studio UI
bash scripts/setup.sh  # First-time DB setup (creates lifehub + pushes schema)
```

No linter or test runner is configured.

## Environment Variables

```
# PostgreSQL
DATABASE_URL=postgresql://localhost:5432/lifehub

# Petit Bambou
PB_USER_UUID=<uuid utilisateur PB>
PB_AUTH_TOKEN=<token JWT issu de l'app mobile PB>

# Auth (NextAuth.js v5)
NEXTAUTH_SECRET=<random base64 string — generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Chess.com (optionnel — intégration Notion chess)
NOTION_TOKEN=secret_...
CHESS_USERNAME=<chess.com username>
NOTION_CHESS_PARENT_PAGE_ID=<page_id>
NOTION_CHESS_RATING_DB=<db_id>
NOTION_CHESS_OPENINGS_DB=<db_id>
NOTION_CHESS_DAILY_DB=<db_id>
NOTION_CHESS_PUZZLES_DB=<db_id>
NOTION_CHESS_FORMATS_DB=<db_id>
```

## Project Purpose

**life×hub** — a local-only Next.js 15 productivity hub. All data lives in a local PostgreSQL database (`lifehub`). The app runs exclusively with `npm run dev`, no cloud deployment. The home page (`/`) lists all modules as cards with a live overview dashboard.

## Architecture

```
app/
  page.tsx                        # Hub home — overview dashboard + module cards
  layout.tsx                      # Root layout: globals.css, auth topbar (logout)
  globals.css                     # CSS variables (theme), global styles, .btn-back, .btn-primary
  login/page.tsx                  # Login page (dark theme, Google sign-in)
  pomodoro/page.tsx               # Pomodoro timer + sessions table + today stats
  projects/page.tsx               # CRUD table — projects with session stats + detail panel
  tasks/page.tsx                  # CRUD table — tasks with column-header filters + session stats
  reminders/page.tsx              # Rappels du quotidien — ajout rapide, filtres, badges retard
  petitbambou/page.tsx            # 4 tabs: Aperçu | Historique | Calendrier | Statistiques
  shopping/page.tsx               # 2 tabs: Général | Par catégorie — wishlist + budget
  chess/page.tsx                  # Chess.com sync (still Notion-backed)
  api/
    auth/[...nextauth]/route.ts   # NextAuth.js catch-all
    overview/route.ts             # GET — live dashboard stats (projects, tasks, today, meditation, shopping, reminders)
    pomodoro/
      projects/route.ts           # GET/POST/PATCH/DELETE — projects with session stats
      tasks/route.ts              # GET/POST/PATCH/DELETE — tasks with filters + session stats
      sessions/route.ts           # GET (last 10) / POST / DELETE
      today-stats/route.ts        # GET — sessions count + minutes today
    reminders/route.ts            # GET/POST/PATCH/DELETE — reminders with due_date + done toggle
    petitbambou/
      stats/route.ts              # GET — PB API metrics + local DB stats + 10 recent sessions
      sync/route.ts               # POST { mode: "today"|"week"|"recent"|"all" } → push to PostgreSQL
      cleanup/route.ts            # POST — deduplicate via pb_uuid
      recompute-streaks/route.ts  # POST — recompute streak column on all rows
      history/route.ts            # GET — all meditations DESC
      analytics/route.ts          # GET — byMonth, byDayOfWeek, streakHistory
    shopping/
      items/route.ts              # GET/POST/PATCH/DELETE — shopping items + budget stats
    chess/
      stats/route.ts              # GET — Chess.com stats + Notion DB setup
      sync/route.ts               # POST — sync games to Notion
      games/route.ts              # GET — fetch raw games
auth.ts                           # NextAuth config: Google provider, email whitelist
middleware.ts                     # Protects all routes except /login and /api/auth/*
lib/
  db.ts                           # PostgreSQL pool + Drizzle instance
  schema.ts                       # Drizzle tables: projects, tasks, sessions, meditations, shopping_items, reminders, project_relations
  petitbambou.ts                  # PB API client + computeStreaks()
  notion-client.ts                # Minimal Notion client — ONLY for chess integration
  chess-notion.ts                 # Chess sync modules (rating, openings, daily, puzzles, formats)
  chess.ts                        # Chess.com API client + game parsing
drizzle.config.ts                 # Drizzle Kit config (schema + DB connection)
scripts/setup.sh                  # First-time DB setup script
types/
  index.ts                        # Shared TS types: DBProject, DBTask, DBSession, PBSession, PBMetrics, etc.
```

## Database Schema (Drizzle — PostgreSQL `lifehub`)

```
projects          id, name, status, type, created_at
tasks             id, name, status, priority, project_id → projects, created_at
sessions          id, name, task_id → tasks, start_time, end_time, notes, created_at
meditations       id, lesson, date, duration_min, pb_uuid (unique), streak, created_at
shopping_items    id, name, category, estimated_price, purchased, store_link, notes, created_at
reminders         id, name, due_date (date), done (bool, default false), created_at
project_relations parent_id → projects, child_id → projects  (composite PK)
```

`duration_min` for sessions is computed on the fly:
`EXTRACT(EPOCH FROM (end_time - start_time)) / 60`

## Adding a New Module

1. **Schema**: add table to `lib/schema.ts`, run `npm run db:migrate`
2. **API routes**: `app/api/<name>/route.ts` — import `db` from `@/lib/db`, tables from `@/lib/schema`
3. **Page**: `app/<name>/page.tsx` — include `<Link href="/" className="btn-back">← Accueil</Link>` at the top of `<main>`
4. **Types**: add to `types/index.ts` if needed
5. **Hub card**: add entry to `integrations` array in `app/page.tsx`
6. **Overview**: update `/api/overview/route.ts` if relevant stats should appear on the home dashboard

## Authentication

Uses **NextAuth.js v5** (beta) with Google OAuth provider.

- Only `a64397573@gmail.com` is allowed — enforced in the `signIn` callback in `auth.ts`
- Any other Google account is redirected to `/login?error=unauthorized`
- `middleware.ts` protects all routes except `/login` and `/api/auth/*`
- Logout button + user email rendered in `layout.tsx` (server component, server action)

### Google Cloud Console setup
- OAuth client type: **Web application**
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

## Dependency Constraints

- **Next.js must stay on `15.2.x`** — 15.3.x and above break `next-auth@beta` (stale Pages Router `_document` error)
- **No UI libraries** — all styling via CSS custom properties from `globals.css` + inline `React.CSSProperties`
- `@notionhq/client` is kept only for the chess integration (`lib/notion-client.ts`)
- **psql binary path on this machine**: `/opt/homebrew/opt/postgresql@16/bin/`

## Key Conventions

- All styling via CSS custom properties: `--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent2`, `--green`, `--red`, `--font-sans`, `--font-mono`, `--shadow-sm`, `--shadow-md`. Light theme.
- Inline `React.CSSProperties` for layout; `globals.css` handles hover/focus states.
- **Column-header filters**: all data tables use inline `ColFilterHeader` / `ColSortHeader` components — clicking a column header opens a dropdown filter. No separate filter bar with `<select>`. Active filters shown with a blue dot indicator.
- **Back button**: every module page includes `<Link href="/" className="btn-back">← Accueil</Link>` as the first child of `<main>`. Style defined in `globals.css`.
- Timer auto-saves only when a work interval completes naturally with a task selected. Resets/skips do not save.
- Selects/dropdowns are disabled while the timer is running.
- `@/` path alias maps to project root (`tsconfig.json`).
- No deployment — local only (`npm run dev`).

## Reminders Module — Specific Notes

- Table `reminders` is **fully independent** from `tasks`, `projects`, `sessions` — no foreign keys.
- Always named "Rappels" in the UI — never "Tâches" to avoid confusion with the Pomodoro tasks.
- `due_date` is a PostgreSQL `date` column (Drizzle `date()`), returned as string `"YYYY-MM-DD"`.
- Sorting: `due_date ASC NULLS LAST` — overdue first, no-date last.
- Done items always rendered at the bottom (opacity 0.45, name strikethrough).
- Badges: "Aujourd'hui" (blue) when `due_date === today`, "En retard" (red) when `due_date < today && !done`.

## Shopping Module — Specific Notes

- Stats: only "Reste à dépenser" is shown (non-purchased items total).
- Sorting: purchased items always sorted to the bottom regardless of the active sort key.
- `purchased` field is included in POST (create) as well as PATCH (edit/toggle).
