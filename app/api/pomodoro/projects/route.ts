import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, project_relations } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    // 1. All projects (no join — avoids cross-product)
    const rows = await db.select().from(projects).orderBy(projects.name);

    // 2. Session stats aggregated per project
    const sessionAgg = await db.execute<{ project_id: string; session_count: string; own_minutes: string }>(sql`
      SELECT project_id,
             count(*) AS session_count,
             coalesce(sum(extract(epoch from (end_time - start_time)) / 60), 0) AS own_minutes
      FROM sessions
      WHERE project_id IS NOT NULL
      GROUP BY project_id
    `);

    // 3. Task count per project
    const taskAgg = await db.execute<{ project_id: string; task_count: string }>(sql`
      SELECT project_id, count(*) AS task_count
      FROM tasks
      WHERE project_id IS NOT NULL
      GROUP BY project_id
    `);

    const sessionByProject = new Map(sessionAgg.rows.map(r => [r.project_id, r]));
    const taskByProject = new Map(taskAgg.rows.map(r => [r.project_id, r]));

    // 4. All relations
    const rels = await db.select().from(project_relations);

    // 3. Build maps
    const childrenMap = new Map<string, string[]>();
    const parentsMap = new Map<string, string[]>();
    for (const rel of rels) {
      if (!childrenMap.has(rel.parent_id)) childrenMap.set(rel.parent_id, []);
      childrenMap.get(rel.parent_id)!.push(rel.child_id);
      if (!parentsMap.has(rel.child_id)) parentsMap.set(rel.child_id, []);
      parentsMap.get(rel.child_id)!.push(rel.parent_id);
    }

    // 5. Compute total_minutes and enrich with parents/children
    const ownMinById = new Map(rows.map(p => [p.id, Number(sessionByProject.get(p.id)?.own_minutes ?? 0)]));
    const result = rows.map(p => {
      const childIds = childrenMap.get(p.id) ?? [];
      const parentIds = parentsMap.get(p.id) ?? [];
      const ownMin = ownMinById.get(p.id) ?? 0;
      const childrenOwnMin = childIds.reduce((sum, cid) => sum + (ownMinById.get(cid) ?? 0), 0);
      const sess = sessionByProject.get(p.id);
      const tasks = taskByProject.get(p.id);

      return {
        ...p,
        task_count: Number(tasks?.task_count ?? 0),
        session_count: Number(sess?.session_count ?? 0),
        own_minutes: ownMin,
        total_minutes: ownMin + childrenOwnMin,
        parents: parentIds.map(pid => ({ id: pid, name: rows.find(r => r.id === pid)?.name ?? "" })),
        children: childIds.map(cid => ({
          id: cid,
          name: rows.find(r => r.id === cid)?.name ?? "",
          own_minutes: ownMinById.get(cid) ?? 0,
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
      // Validate: if this project has children, it can't become a child
      const existingChildren = await db.select().from(project_relations).where(eq(project_relations.parent_id, id));
      if (existingChildren.length > 0 && parent_ids.length > 0) {
        return NextResponse.json({ error: "Un projet avec des sous-projets ne peut pas avoir de parents" }, { status: 400 });
      }

      // Cycle check: none of parent_ids should already be children of this project
      const childIds = existingChildren.map(r => r.child_id);
      const hasCycle = parent_ids.some((pid: string) => childIds.includes(pid));
      if (hasCycle) {
        return NextResponse.json({ error: "Cycle détecté dans les relations" }, { status: 400 });
      }

      // Replace relations
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
    // project_relations cascade deletes automatically via FK onDelete: "cascade"
    await db.delete(projects).where(eq(projects.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
