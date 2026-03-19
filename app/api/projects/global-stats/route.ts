import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/schema";
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

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weeksAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  try {
    const ninetyDaysAgo = daysAgo(90);

    const [kpiTasksRow, kpiProjectsRow, tasksByWeekRows, heatmapRows] = await Promise.all([
      db
        .select({
          total_tasks: sql<number>`count(*)`,
          completed_tasks: sql<number>`count(*) filter (where status = 'Terminé')`,
        })
        .from(tasks),

      db
        .select({
          total_projects: sql<number>`count(*)`,
          active_projects: sql<number>`count(*) filter (where status = 'En cours')`,
        })
        .from(projects),

      db
        .select({
          week: sql<string>`to_char(date_trunc('week', created_at), 'YYYY-MM-DD')`,
          created: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where status = 'Terminé')`,
        })
        .from(tasks)
        .where(gte(tasks.created_at, weeksAgo(8)))
        .groupBy(sql`date_trunc('week', created_at)`)
        .orderBy(sql`date_trunc('week', created_at)`),

      db
        .select({
          date: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)`,
        })
        .from(tasks)
        .where(and(eq(tasks.status, "Terminé"), gte(tasks.created_at, ninetyDaysAgo)))
        .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(created_at, 'YYYY-MM-DD')`),
    ]);

    const totalTasks = Number(kpiTasksRow[0]?.total_tasks ?? 0);
    const completedTasks = Number(kpiTasksRow[0]?.completed_tasks ?? 0);

    const taskWeekMap = new Map(
      tasksByWeekRows.map((r) => [r.week, { created: Number(r.created), completed: Number(r.completed) }]),
    );
    const tasksByWeek = Array.from({ length: 8 }, (_, i) => {
      const ws = getWeekStart(7 - i);
      const key = localDateStr(ws);
      const label = ws.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      const d = taskWeekMap.get(key) ?? { created: 0, completed: 0 };
      return { week: label, ...d };
    });

    return NextResponse.json({
      kpis: {
        total_projects: Number(kpiProjectsRow[0]?.total_projects ?? 0),
        active_projects: Number(kpiProjectsRow[0]?.active_projects ?? 0),
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        completion_pct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      tasksByWeek,
      heatmap: heatmapRows.map((r) => ({ date: r.date, count: Number(r.count) })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
