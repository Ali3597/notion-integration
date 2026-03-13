import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks, sessions, project_relations } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    // 1. Direct stats per project (own sessions + task count)
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        type: projects.type,
        created_at: projects.created_at,
        task_count: sql<number>`count(distinct ${tasks.id})`,
        session_count: sql<number>`count(distinct ${sessions.id})`,
        own_minutes: sql<number>`coalesce(sum(extract(epoch from (${sessions.end_time} - ${sessions.start_time})) / 60) filter (where ${sessions.id} is not null), 0)`,
      })
      .from(projects)
      .leftJoin(tasks, eq(tasks.project_id, projects.id))
      .leftJoin(sessions, eq(sessions.project_id, projects.id))
      .groupBy(projects.id)
      .orderBy(projects.name);

    // 2. All relations
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

    // 4. Compute total_minutes and enrich with parents/children
    const projectById = new Map(rows.map(p => [p.id, p]));
    const result = rows.map(p => {
      const childIds = childrenMap.get(p.id) ?? [];
      const parentIds = parentsMap.get(p.id) ?? [];
      const ownMin = Number(p.own_minutes ?? 0);
      const childrenOwnMin = childIds.reduce((sum, cid) => sum + Number(projectById.get(cid)?.own_minutes ?? 0), 0);

      return {
        ...p,
        own_minutes: ownMin,
        total_minutes: ownMin + childrenOwnMin,
        parents: parentIds.map(pid => ({ id: pid, name: projectById.get(pid)?.name ?? "" })),
        children: childIds.map(cid => {
          const ch = projectById.get(cid);
          return { id: cid, name: ch?.name ?? "", own_minutes: Number(ch?.own_minutes ?? 0) };
        }),
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
