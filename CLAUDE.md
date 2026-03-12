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

# iCloud Calendar (dashboard widget)
ICAL_URL=<URL ICS publique iCloud — jamais exposée côté client>

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
  globals.css                     # CSS variables (theme), global styles, .btn-back, .btn-primary, cursor fixes
  login/page.tsx                  # Login page (dark theme, Google sign-in)
  pomodoro/page.tsx               # Pomodoro timer + sessions table + today stats
  projects/page.tsx               # CRUD table — projects with session stats + column-header filters
  tasks/page.tsx                  # CRUD table — tasks with column-header filters + session stats
  reminders/page.tsx              # Rappels du quotidien — ajout rapide, filtres, badges retard
  petitbambou/page.tsx            # 4 tabs: Aperçu | Historique | Calendrier | Statistiques
  shopping/page.tsx               # 2 tabs: Général | Par catégorie — wishlist + budget
  chess/page.tsx                  # Chess.com sync (still Notion-backed)
  library/page.tsx                # 5 tabs: Ma Bibliothèque | Auteurs | Genres | Séries | Notes
  habits/page.tsx                 # 3 tabs: Aujourd'hui (checklist+streaks) | Calendrier (par habitude) | Statistiques (Recharts: heatmap, bar, line, radar)
  api/
    auth/[...nextauth]/route.ts   # NextAuth.js catch-all
    overview/route.ts             # GET — live dashboard stats (projects, tasks, today, meditation, shopping, reminders, library)
    pomodoro/
      projects/route.ts           # GET/POST/PATCH/DELETE — projects with session stats
      projects/relations/route.ts # GET/POST/DELETE — parent-child project relations
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
    library/
      books/route.ts              # GET/POST/PATCH/DELETE — books with author/genre/serie joins + filters
      authors/route.ts            # GET/POST/PATCH/DELETE — authors with book_count
      genres/route.ts             # GET/POST/PATCH/DELETE — genres with icon + book_count
      series/route.ts             # GET/POST/PATCH/DELETE — series with author_name + book_count
      notes/route.ts              # GET (optional ?book_id=) / POST/PATCH/DELETE — book notes
    habits/route.ts               # GET (with stats: streak, completion_rate, completed_today) / POST / PATCH ?id= / DELETE ?id=
    habits/log/route.ts           # GET ?from=&to=&habit_id= / POST { habit_id, completed_date, note? } / DELETE ?habit_id=&date=
    habits/stats/route.ts         # GET ?id=&days= — heatmap, byDayOfWeek, byMonth, streakHistory for Recharts
    habits/overview/route.ts      # GET — 90-day grid for all active habits (dates[], grid{ habit_id: dates[] })
auth.ts                           # NextAuth config: Google provider, email whitelist
middleware.ts                     # Protects all routes except /login and /api/auth/*
lib/
  db.ts                           # PostgreSQL pool + Drizzle instance
  schema.ts                       # Drizzle tables: projects, tasks, sessions, meditations, shopping_items, reminders, project_relations, authors, genres, series, books, book_notes, habits, habit_logs
  petitbambou.ts                  # PB API client + computeStreaks()
  notion-client.ts                # Minimal Notion client — ONLY for chess integration
  chess-notion.ts                 # Chess sync modules (rating, openings, daily, puzzles, formats)
  chess.ts                        # Chess.com API client + game parsing
drizzle.config.ts                 # Drizzle Kit config (schema + DB connection)
scripts/setup.sh                  # First-time DB setup script
types/
  index.ts                        # Shared TS types: DBProject, DBTask, DBSession, PBSession, PBMetrics, DBAuthor, DBGenre, DBSerie, DBBook, DBBookNote, etc.
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
authors           id, name, photo_url, created_at
genres            id, name, icon, created_at
series            id, name, author_id → authors, status, created_at
books             id, title, author_id → authors, genre_id → genres, serie_id → series, status, rating, image_url, started_at (date), finished_at (date), created_at
book_notes        id, title, book_id → books (cascade delete), content, created_at
habits            id, name, description, icon, color, frequency_type, frequency_days (JSON), target_per_period, active (bool), created_at, archived_at
habit_logs        id, habit_id → habits (cascade), completed_date (date), note, created_at — UNIQUE(habit_id, completed_date)
```

`duration_min` for sessions is computed on the fly:
`EXTRACT(EPOCH FROM (end_time - start_time)) / 60`

## Adding a New Module

1. **Schema**: add table to `lib/schema.ts`, run `npm run db:migrate`
2. **API routes**: `app/api/<name>/route.ts` — import `db` from `@/lib/db`, tables from `@/lib/schema`
3. **Page**: `app/<name>/page.tsx` — include `<Link href="/" className="btn-back">← Accueil</Link>` as the first child of `<main>`
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
- **Cursor fix**: `* { cursor: default }` global reset requires explicit fixes — `a[href], a[href] * { cursor: pointer }`, `button * { cursor: inherit }`, `.clickable-row td { cursor: pointer }` are all defined in `globals.css`. Add `className="clickable-row"` to `<tr>` elements that should be fully clickable.
- **Image loading**: external images (e.g. Open Library covers) use a gradient placeholder that fades out on `onLoad`. Use `-M.jpg` size suffix for Open Library URLs (good quality/size tradeoff).
- Timer auto-saves only when a work interval completes naturally with a task selected. Resets/skips do not save.
- Selects/dropdowns are disabled while the timer is running.
- `@/` path alias maps to project root (`tsconfig.json`).
- No deployment — local only (`npm run dev`).

## Reminders Module — Specific Notes

- Table `reminders` is **fully independent** from `tasks`, `projects`, `sessions` — no foreign keys.
- Always named "Rappels" in the UI — never "Tâches" to avoid confusion with the Pomodoro tasks.
- `due_date` is a PostgreSQL `date` column (Drizzle `date()`), returned as string `"YYYY-MM-DD"`.
- Sorting: `due_date ASC NULLS LAST` — overdue first, no-date last.
- Done items always rendered at the bottom (opacity 0.45, name strikethrough via `textDecorationLine`).
- Badges: "Aujourd'hui" (blue) when `due_date === today`, "En retard" (red) when `due_date < today && !done`.
- Use `textDecorationLine` (not `textDecoration` shorthand) when also setting `textDecorationColor` — avoids React style conflict warning.

## Shopping Module — Specific Notes

- Stats: only "Reste à dépenser" is shown (non-purchased items total).
- Sorting: purchased items always sorted to the bottom regardless of the active sort key.
- `purchased` field is included in POST (create) as well as PATCH (edit/toggle).

## Library Module — Specific Notes

- 5 tabs: **Ma Bibliothèque** (grid cards by status sub-tab), **Auteurs** (grid with avatar), **Genres** (colored grid with icon), **Séries** (table), **Notes** (table).
- Book statuses: `"En cours"`, `"Souhait"`, `"Pas Lu"`, `"Lu"`.
- Serie statuses: `"En cours"`, `"Terminé"`, `"Abandonné"`.
- **BookCover component**: shows gradient placeholder with initials immediately, then fades in the real image on `onLoad` (smooth UX even on slow external loads).
- **Image URLs**: use Open Library CDN — books: `https://covers.openlibrary.org/b/id/{id}-M.jpg`, authors: `https://covers.openlibrary.org/a/id/{id}-M.jpg`. Use `-M.jpg` (not `-L.jpg`) for faster loading.
- **Genre icons**: stored in the `icon` column of the `genres` table (emoji string). Current icons: 🌱 Développement Personnel, 📝 Essai, ⚔️ Fantaisie, 🖊️ Poésie, 📖 Roman, 🚀 Science Fiction.
- `book_notes` cascade-deletes when the parent book is deleted.
- The `BookDrawer` component handles inline note creation/editing/deletion directly without a separate page.
- Overview stat: `library: { reading, read }` — count of books with status `"En cours"` and `"Lu"`.

## Habitudes Module — Specific Notes

- 3 tabs: **Aujourd'hui** (checklist with streaks, progress bar, toggle for not-due-today), **Calendrier** (per-habit mini-grid per month), **Statistiques** (Recharts charts per habit).
- Frequency types: `"daily"`, `"weekly"`, `"specific_days"`, `"monthly"`.
  - `daily` — due every day.
  - `specific_days` — `frequency_days` is a JSON array of ISO weekday numbers (1=Mon … 7=Sun).
  - `weekly` — due any day; `target_per_period` = how many times per week (for streak logic).
  - `monthly` — `frequency_days` is a string with the day-of-month number (e.g. `"15"`).
- `habit_logs` has a UNIQUE constraint on `(habit_id, completed_date)`. POST to `/api/habits/log` uses `onConflictDoUpdate` (safe upsert).
- Streak logic: walks backward through "due dates" only (respecting frequency_type); skips today if not yet completed to avoid breaking streak.
- Dashboard widget: shows only habits due today with quick toggle checkboxes.
- Archive via `PATCH ?id= { active: false, archived_at: ... }` — archived habits disappear from all views.
- `isHabitDue()` helper is duplicated in `app/api/habits/route.ts`, `app/api/habits/stats/route.ts`, `app/api/dashboard/route.ts`, and `app/habits/page.tsx` (client-side) — kept local to each to avoid shared import complexity.
