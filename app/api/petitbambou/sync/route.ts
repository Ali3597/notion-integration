import { NextResponse } from "next/server";
import { getSessionsLastWeek, getSessionsLast3Months, getAllSessions, getTodaySessions } from "@/lib/petitbambou";
import { MEDITATIONS_DB, setupMeditationsDB, cleanupMeditationsDBSchema, pushMeditationSessions } from "@/lib/notion";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode: "recent" | "all" | "today" | "week" = body.mode ?? "recent";
    const parentPageId: string | undefined = body.parentPageId;

    let dbId = MEDITATIONS_DB;
    let dbCreated = false;

    if (!dbId) {
      if (!parentPageId) {
        return NextResponse.json(
          { error: "NOTION_MEDITATIONS_DB non configuré. Fournis un parentPageId pour créer la DB." },
          { status: 400 }
        );
      }
      dbId = await setupMeditationsDB(parentPageId);
      dbCreated = true;
    }

    await cleanupMeditationsDBSchema(dbId);

    let sessions: Awaited<ReturnType<typeof getTodaySessions>>;
    if (mode === "all") {
      sessions = await getAllSessions();
    } else if (mode === "today") {
      sessions = await getTodaySessions();
    } else if (mode === "week") {
      sessions = await getSessionsLastWeek();
    } else {
      sessions = await getSessionsLast3Months();
    }

    const { pushed, errors } = await pushMeditationSessions(sessions, dbId);

    return NextResponse.json({
      pushed,
      errors,
      ...(dbCreated ? { dbCreated: true, dbId } : {}),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur sync Petit Bambou" }, { status: 500 });
  }
}
