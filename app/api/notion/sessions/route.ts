import { NextResponse } from "next/server";
import { notion, SESSIONS_DB } from "@/lib/notion";

export async function POST(request: Request) {
  try {
    const { taskId, startTime, endTime, durationMin, notes } =
      await request.json();

    const now = new Date();
    const sessionName = `Session — ${now.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const page = await notion.pages.create({
      parent: { database_id: SESSIONS_DB },
      properties: {
        Name: {
          title: [{ text: { content: sessionName } }],
        },
        Task: {
          relation: [{ id: taskId }],
        },
        "Start Time": {
          date: { start: startTime },
        },
        "End Time": {
          date: { start: endTime },
        },
        Notes: {
          rich_text: notes ? [{ text: { content: notes } }] : [],
        },
      },
    });

    return NextResponse.json({ success: true, id: page.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur Notion" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const response = await notion.databases.query({
      database_id: SESSIONS_DB,
      sorts: [{ property: "Start Time", direction: "descending" }],
      page_size: 10,
    });

    const sessions = response.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text ?? "Session",
      startTime: page.properties["Start Time"]?.date?.start ?? null,
      endTime: page.properties["End Time"]?.date?.start ?? null,
      duration: page.properties["Duration (min)"]?.formula?.number ?? null,
      task: page.properties.Task?.relation?.[0]?.id ?? null,
    }));

    return NextResponse.json(sessions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur Notion" }, { status: 500 });
  }
}
