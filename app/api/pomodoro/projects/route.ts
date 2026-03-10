import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks, sessions } from "@/lib/schema";
import { eq, count, sum, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        type: projects.type,
        created_at: projects.created_at,
        task_count: count(tasks.id),
        session_count: sql<number>`count(distinct ${sessions.id})`,
        total_minutes: sql<number>`coalesce(sum(extract(epoch from (${sessions.end_time} - ${sessions.start_time})) / 60), 0)`,
      })
      .from(projects)
      .leftJoin(tasks, eq(tasks.project_id, projects.id))
      .leftJoin(sessions, eq(sessions.task_id, tasks.id))
      .groupBy(projects.id)
      .orderBy(projects.name);

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, status, type } = await request.json();
    if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });
    const [row] = await db.insert(projects).values({ name, status, type }).returning();
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
    const [row] = await db.update(projects).set(body).where(eq(projects.id, id)).returning();
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
    await db.delete(projects).where(eq(projects.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
