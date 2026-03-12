import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, sessions, projects } from "@/lib/schema";
import { eq, and, ne, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  try {
    const base = db
      .select({
        id: tasks.id,
        name: tasks.name,
        status: tasks.status,
        priority: tasks.priority,
        project_id: tasks.project_id,
        project_name: projects.name,
        session_count: sql<number>`count(distinct ${sessions.id})`,
        total_minutes: sql<number>`coalesce(sum(extract(epoch from (${sessions.end_time} - ${sessions.start_time})) / 60), 0)`,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.project_id, projects.id))
      .leftJoin(sessions, eq(sessions.task_id, tasks.id))
      .groupBy(tasks.id, projects.name)
      .orderBy(tasks.name);

    const allParam = searchParams.get("all");
    const rows = projectId
      ? allParam === "true"
        ? await base.where(eq(tasks.project_id, projectId))
        : await base.where(and(ne(tasks.status, "Terminé"), eq(tasks.project_id, projectId)))
      : await base;

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, status, priority, project_id } = await request.json();
    if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });
    const [row] = await db.insert(tasks).values({ name, status, priority, project_id }).returning();
    return NextResponse.json(row);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const body = await request.json();
    const [row] = await db.update(tasks).set(body).where(eq(tasks.id, id)).returning();
    return NextResponse.json(row);
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
    await db.delete(tasks).where(eq(tasks.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
