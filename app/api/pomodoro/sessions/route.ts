import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, tasks, projects } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: sessions.id,
        name: sessions.name,
        start_time: sessions.start_time,
        end_time: sessions.end_time,
        notes: sessions.notes,
        task_name: tasks.name,
        project_name: projects.name,
        duration_min: sql<number>`round(extract(epoch from (${sessions.end_time} - ${sessions.start_time})) / 60)`,
      })
      .from(sessions)
      .leftJoin(tasks, eq(sessions.task_id, tasks.id))
      .leftJoin(projects, eq(tasks.project_id, projects.id))
      .orderBy(desc(sessions.start_time))
      .limit(10);

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { taskId, startTime, endTime, notes } = await request.json();
    const now = new Date();
    const name = `Session — ${now.toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })}`;
    const [row] = await db
      .insert(sessions)
      .values({
        name,
        task_id: taskId ?? null,
        start_time: startTime ? new Date(startTime) : null,
        end_time: endTime ? new Date(endTime) : null,
        notes: notes ?? null,
      })
      .returning();
    return NextResponse.json({ success: true, id: row.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await db.delete(sessions).where(eq(sessions.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
