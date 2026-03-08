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

Create `.env.local` at the root with:

```
NOTION_TOKEN=secret_...
NOTION_PROJECTS_DB=<database_id>
NOTION_TASKS_DB=<database_id>
NOTION_SESSIONS_DB=<database_id>
```

## Architecture

This is a Next.js 15 app (App Router) with a single page. All logic lives in `app/page.tsx` as a client component — there are no separate component files.

**Data flow:**
- `lib/notion.ts` — initializes the `@notionhq/client` and exports the three database IDs from env vars.
- `app/api/notion/projects/route.ts` — `GET` returns all projects sorted by name.
- `app/api/notion/tasks/route.ts` — `GET` returns non-Done tasks, filtered by `projectId` query param via a `Project` relation property.
- `app/api/notion/sessions/route.ts` — `GET` returns last 10 sessions sorted by Start Time desc; `POST` creates a new session page linked to a task.

**Notion database schema assumed:**
- **Projects**: `Name` (title), `Status` (select), `Type` (select)
- **Tasks**: `Name` (title), `Status` (select), `Priority` (select — High/Medium/Low), `Project` (relation → Projects)
- **Sessions**: `Name` (title), `Task` (relation → Tasks), `Start Time` (date), `End Time` (date), `Notes` (rich_text), `Duration (min)` (formula — computed from start/end)

**Timer behavior:** The timer auto-saves a session to Notion only when a work interval completes naturally (reaches zero) and a task is selected. Manual resets/skips do not save. After a work session ends it auto-switches to break mode and vice versa.

**Styling:** All styles are inline `React.CSSProperties` objects defined at the bottom of `app/page.tsx`. CSS custom properties (e.g. `--bg`, `--accent`, `--surface`) are defined in `app/globals.css`.
