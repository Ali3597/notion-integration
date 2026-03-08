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
NOTION_TOKEN=secret_...

# Pomodoro integration
NOTION_PROJECTS_DB=<database_id>
NOTION_TASKS_DB=<database_id>
NOTION_SESSIONS_DB=<database_id>
```

## Project Purpose

This is a **Notion integration hub** — a Next.js 15 app that centralizes multiple integrations between Notion and external tools. The home page (`/`) lists all integrations as cards. Each integration lives in its own route.

## Architecture

```
app/
  page.tsx                        # Hub landing page — lists all integrations
  layout.tsx                      # Root layout, imports globals.css
  globals.css                     # CSS variables (theme), global styles for inputs/selects/buttons
  pomodoro/
    page.tsx                      # Pomodoro timer app (client component)
  api/
    pomodoro/
      projects/route.ts           # GET — query Notion Projects DB
      tasks/route.ts              # GET ?projectId= — query Tasks filtered by project
      sessions/route.ts           # GET — last 10 sessions / POST — create session
lib/
  notion.ts                       # Shared Notion client + DB ID constants (from env)
types/
  index.ts                        # Shared TypeScript types: NotionProject, NotionTask, NotionSession
```

## Adding a New Integration

1. **Page**: `app/<name>/page.tsx`
2. **API routes**: `app/api/<name>/route.ts` (import from `@/lib/notion`)
3. **Types**: add to `types/index.ts` if new Notion entities are involved
4. **Hub card**: add an entry to the `integrations` array in `app/page.tsx`
5. **Env vars**: add new DB IDs to `.env.local` and `lib/notion.ts`

## Notion Database Schema (Pomodoro)

- **Projects**: `Name` (title), `Status` (select), `Type` (select)
- **Tasks**: `Name` (title), `Status` (select), `Priority` (select — High/Medium/Low), `Project` (relation → Projects)
- **Sessions**: `Name` (title), `Task` (relation → Tasks), `Start Time` (date), `End Time` (date), `Notes` (rich_text), `Duration (min)` (formula)

## Key Conventions

- All styling uses CSS custom properties defined in `globals.css` (`--bg`, `--surface`, `--accent`, etc.). Light theme.
- Inline `React.CSSProperties` objects are used for layout/structure; `globals.css` handles interactive states (hover, focus).
- Timer auto-saves a session to Notion only when a work interval completes naturally with a task selected. Resets/skips do not save.
- Selects and project/task dropdowns are disabled while the timer is running.
- The `@/` path alias maps to the project root (configured in `tsconfig.json`).
