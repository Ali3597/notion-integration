import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/schema";
import { eq, and, ne, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const allParam = searchParams.get("all");

  try {
    const base = db
      .select({
        id: tasks.id,
        name: tasks.name,
        status: tasks.status,
        project_id: tasks.project_id,
        project_name: projects.name,
        issue_number: tasks.issue_number,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.project_id, projects.id));

    let rows;
    if (projectId) {
      rows = allParam === "true"
        ? await base.where(eq(tasks.project_id, projectId)).orderBy(tasks.issue_number)
        : await base.where(and(ne(tasks.status, "Terminé"), eq(tasks.project_id, projectId))).orderBy(tasks.issue_number);
    } else {
      rows = await base.orderBy(tasks.issue_number);
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, status, project_id } = await request.json();
    if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });

    let issue_number: number | undefined;
    if (project_id) {
      const [updated] = await db
        .update(projects)
        .set({ issue_counter: sql`${projects.issue_counter} + 1` })
        .where(eq(projects.id, project_id))
        .returning({ issue_counter: projects.issue_counter });
      issue_number = updated?.issue_counter ?? undefined;
    }

    const [row] = await db
      .insert(tasks)
      .values({ name, status, project_id, issue_number })
      .returning();
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
    // Never allow issue_number to be modified
    const { issue_number: _ignored, ...updateData } = body;
    const [row] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
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
