import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, project_relations, projects } from "@/lib/schema";
import { eq, and, gte, sql } from "drizzle-orm";

function getWeekStart(offsetWeeks: number): Date {
  const d = new Date();
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset - offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weeksAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const childRels = await db
      .select({ child_id: project_relations.child_id, child_name: projects.name })
      .from(project_relations)
      .leftJoin(projects, eq(projects.id, project_relations.child_id))
      .where(eq(project_relations.parent_id, id));

    const isParent = childRels.length > 0;

    const [taskStats, taskWeekRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          done: sql<number>`count(*) filter (where status = 'Terminé')`,
          in_progress: sql<number>`count(*) filter (where status = 'En cours')`,
        })
        .from(tasks)
        .where(eq(tasks.project_id, id)),

      db
        .select({
          week: sql<string>`to_char(date_trunc('week', created_at), 'YYYY-MM-DD')`,
          created: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where status = 'Terminé')`,
        })
        .from(tasks)
        .where(and(eq(tasks.project_id, id), gte(tasks.created_at, weeksAgo(8))))
        .groupBy(sql`date_trunc('week', created_at)`)
        .orderBy(sql`date_trunc('week', created_at)`),
    ]);

    const ts = taskStats[0];
    const total = Number(ts?.total ?? 0);
    const done = Number(ts?.done ?? 0);
    const inProgress = Number(ts?.in_progress ?? 0);

    const taskWeekMap = new Map(
      taskWeekRows.map((r) => [r.week, { created: Number(r.created), completed: Number(r.completed) }]),
    );
    const tasksByWeek = Array.from({ length: 8 }, (_, i) => {
      const ws = getWeekStart(7 - i);
      const key = localDateStr(ws);
      const label = ws.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      const d = taskWeekMap.get(key) ?? { created: 0, completed: 0 };
      return { week: label, ...d };
    });

    return NextResponse.json({
      completion: {
        total,
        done,
        in_progress: inProgress,
        todo: total - done - inProgress,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
      },
      isParent,
      children: childRels.map((rel) => ({ id: rel.child_id, name: rel.child_name ?? "" })),
      tasksByWeek,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
