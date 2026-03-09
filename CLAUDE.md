# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
```

No linter or test runner is configured.

## Environment Variables

```
# Notion
NOTION_TOKEN=secret_...
NOTION_PROJECTS_DB=<database_id>
NOTION_TASKS_DB=<database_id>
NOTION_SESSIONS_DB=<database_id>

# Petit Bambou
NOTION_MEDITATIONS_DB=<database_id>   # auto-créé au premier lancement si absent
PB_USER_UUID=<uuid utilisateur PB>
PB_AUTH_TOKEN=<token JWT issu de l'app mobile PB>

# Auth (NextAuth.js v5)
NEXTAUTH_SECRET=<random base64 string — generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000   # set to production URL on Vercel
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

## Project Purpose

This is a **Notion integration hub** — a Next.js 15 app that centralizes multiple integrations between Notion and external tools. The home page (`/`) lists all integrations as cards. Each integration lives in its own route.

## Architecture

```
app/
  page.tsx                        # Hub landing page — lists all integrations
  layout.tsx                      # Root layout: imports globals.css, renders auth topbar (logout)
  globals.css                     # CSS variables (theme), global styles for inputs/selects/buttons
  login/
    page.tsx                      # Login page (dark theme, Google sign-in button)
  pomodoro/
    page.tsx                      # Pomodoro timer app (client component)
  petitbambou/
    page.tsx                      # Petit Bambou sync page (client component)
  api/
    auth/[...nextauth]/route.ts   # NextAuth.js catch-all handler
    pomodoro/
      projects/route.ts           # GET — query Notion Projects DB
      tasks/route.ts              # GET ?projectId= — query Tasks filtered by project
      sessions/route.ts           # GET — last 10 sessions / POST — create session
    petitbambou/
      stats/route.ts              # GET — metrics + dernières sessions PB + dbConfigured flag
      sync/route.ts               # POST { mode: "today"|"week"|"recent"|"all", parentPageId? }
      cleanup/route.ts            # POST — supprime les doublons Notion par PB_UUID
auth.ts                           # NextAuth config: Google provider, allowed email whitelist
middleware.ts                     # Redirects unauthenticated users to /login for all routes
lib/
  notion.ts                       # Shared Notion client + DB ID constants (from env)
  petitbambou.ts                  # Client API Petit Bambou (headers custom, fetch sessions/metrics)
types/
  index.ts                        # Shared TypeScript types: NotionProject, NotionTask, NotionSession, PBSession, PBMetrics
```

## Adding a New Integration

1. **Page**: `app/<name>/page.tsx`
2. **API routes**: `app/api/<name>/route.ts` (import from `@/lib/notion`)
3. **Types**: add to `types/index.ts` if new Notion entities are involved
4. **Hub card**: add an entry to the `integrations` array in `app/page.tsx`
5. **Env vars**: add new DB IDs to `.env.local` and `lib/notion.ts`

## Notion Database Schemas

### Pomodoro
- **Projects**: `Name` (title), `Status` (select), `Type` (select)
- **Tasks**: `Name` (title), `Status` (select), `Priority` (select — High/Medium/Low), `Project` (relation → Projects)
- **Sessions**: `Name` (title), `Task` (relation → Tasks), `Start Time` (date), `End Time` (date), `Notes` (rich_text), `Duration (min)` (formula)

### Petit Bambou (Méditations)
- **Leçon** (title), **Date** (date — UTC, dérivée de `activity_time` unix), **Durée (min)** (number), **PB_UUID** (rich_text — identifiant unique de session, clé de déduplication)
- La colonne `PB_UUID` est créée automatiquement par `ensurePBUUIDColumn()` si absente
- Déduplication : à chaque sync, les UUIDs déjà présents dans Notion sont récupérés et filtrés — aucun doublon possible

## Authentication

Uses **NextAuth.js v5** (beta) with Google OAuth provider.

- Only `a64397573@gmail.com` is allowed — enforced in the `signIn` callback in `auth.ts`
- Any other Google account gets redirected to `/login?error=unauthorized`
- `middleware.ts` protects all routes except `/login` and `/api/auth/*`
- The logout button + user email are rendered in `layout.tsx` (server component, server action)
- The login page (`/login`) has its own dark theme styles inline (independent of `globals.css`)

### Google Cloud Console setup
- OAuth client type: **Web application**
- Authorized redirect URIs must include:
  - `http://localhost:3000/api/auth/callback/google` (dev)
  - `https://<your-vercel-domain>/api/auth/callback/google` (prod)

## Deployment (Vercel)

Connected to GitHub — pushes to `main` trigger automatic deployments.

Environment variables to set in Vercel dashboard (Settings → Environment Variables):
`NOTION_TOKEN`, `NOTION_PROJECTS_DB`, `NOTION_TASKS_DB`, `NOTION_SESSIONS_DB`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (set to the Vercel production URL), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

Production URL: `https://notion-integration-teal.vercel.app`
`NEXTAUTH_URL` on Vercel is set to the production URL. Local `.env.local` keeps `http://localhost:3000`.

## Dependency Constraints

- **Next.js must stay on `15.2.x`** — do not upgrade to 15.3.x or 16.x. Those versions break `next-auth@beta` (build fails with a stale Pages Router `_document` error). Next.js 15.2.9 is the current version, which patches CVE-2025-66478.
- If the `.next` cache becomes corrupt (e.g. after a failed version upgrade), delete it with `rm -rf .next` before rebuilding.

## Key Conventions

- All styling uses CSS custom properties defined in `globals.css` (`--bg`, `--surface`, `--accent`, etc.). Light theme.
- Inline `React.CSSProperties` objects are used for layout/structure; `globals.css` handles interactive states (hover, focus).
- Timer auto-saves a session to Notion only when a work interval completes naturally with a task selected. Resets/skips do not save.
- Selects and project/task dropdowns are disabled while the timer is running.
- The `@/` path alias maps to the project root (configured in `tsconfig.json`).
