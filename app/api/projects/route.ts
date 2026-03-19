import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, project_relations, tasks } from "@/lib/schema";
import { eq, isNotNull, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(projects).orderBy(projects.name);

    const taskAgg = await db
      .select({
        project_id: tasks.project_id,
        task_count: sql<string>`count(*)`,
        completed_count: sql<string>`count(*) filter (where status = 'Terminé')`,
      })
      .from(tasks)
      .where(isNotNull(tasks.project_id))
      .groupBy(tasks.project_id);

    const taskByProject = new Map(taskAgg.map(r => [r.project_id!, r]));

    const rels = await db.select().from(project_relations);

    const childrenMap = new Map<string, string[]>();
    const parentsMap = new Map<string, string[]>();
    for (const rel of rels) {
      if (!childrenMap.has(rel.parent_id)) childrenMap.set(rel.parent_id, []);
      childrenMap.get(rel.parent_id)!.push(rel.child_id);
      if (!parentsMap.has(rel.child_id)) parentsMap.set(rel.child_id, []);
      parentsMap.get(rel.child_id)!.push(rel.parent_id);
    }

    const result = rows.map(p => {
      const childIds = childrenMap.get(p.id) ?? [];
      const parentIds = parentsMap.get(p.id) ?? [];
      const taskRow = taskByProject.get(p.id);

      return {
        ...p,
        task_count: Number(taskRow?.task_count ?? 0),
        completed_tasks: Number(taskRow?.completed_count ?? 0),
        parents: parentIds.map(pid => ({ id: pid, name: rows.find(r => r.id === pid)?.name ?? "" })),
        children: childIds.map(cid => ({
          id: cid,
          name: rows.find(r => r.id === cid)?.name ?? "",
        })),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, status, type, parent_ids = [] } = await request.json();
    if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });

    const [row] = await db.insert(projects).values({ name, status, type }).returning();

    if (parent_ids.length > 0) {
      await db.insert(project_relations).values(
        parent_ids.map((pid: string) => ({ parent_id: pid, child_id: row.id }))
      );
    }

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

    const { parent_ids, ...fields } = await request.json();
    const [row] = await db.update(projects).set(fields).where(eq(projects.id, id)).returning();

    if (parent_ids !== undefined) {
      const existingChildren = await db.select().from(project_relations).where(eq(project_relations.parent_id, id));
      if (existingChildren.length > 0 && parent_ids.length > 0) {
        return NextResponse.json({ error: "Un projet avec des sous-projets ne peut pas avoir de parents" }, { status: 400 });
      }

      const childIds = existingChildren.map(r => r.child_id);
      const hasCycle = parent_ids.some((pid: string) => childIds.includes(pid));
      if (hasCycle) {
        return NextResponse.json({ error: "Cycle détecté dans les relations" }, { status: 400 });
      }

      await db.delete(project_relations).where(eq(project_relations.child_id, id));
      if (parent_ids.length > 0) {
        await db.insert(project_relations).values(
          parent_ids.map((pid: string) => ({ parent_id: pid, child_id: id }))
        );
      }
    }

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
