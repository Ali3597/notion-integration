import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, sessions, project_relations, projects } from "@/lib/schema";
import { eq, and, gte, isNotNull, sql, inArray } from "drizzle-orm";

/** Monday of the week that is `offsetWeeks` weeks ago (local timezone). */
function getWeekStart(offsetWeeks: number): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun … 6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset - offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a Date as YYYY-MM-DD in local timezone (not UTC). */
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
    // Resolve child project IDs (1-level deep)
    const childRels = await db
      .select({ child_id: project_relations.child_id, child_name: projects.name })
      .from(project_relations)
      .leftJoin(projects, eq(projects.id, project_relations.child_id))
      .where(eq(project_relations.parent_id, id));

    const childIds = childRels.map((r) => r.child_id);
    const isParent = childIds.length > 0;

    // All project IDs to aggregate (own + children)
    const allIds = [id, ...childIds];

    const [taskStats, totalRow, sessionWeekRows, taskWeekRows, dowRows, monthlyRows] =
      await Promise.all([
        // Task completion — own project only (children have their own kanban)
        db
          .select({
            total: sql<number>`count(*)`,
            done: sql<number>`count(*) filter (where status = 'Terminé')`,
            in_progress: sql<number>`count(*) filter (where status = 'En cours')`,
          })
          .from(tasks)
          .where(eq(tasks.project_id, id)),

        // Total session minutes — own + children
        db
          .select({
            minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
            session_count: sql<number>`count(*)`,
          })
          .from(sessions)
          .where(and(inArray(sessions.project_id, allIds), isNotNull(sessions.end_time))),

        // Sessions grouped by ISO week — last 4 weeks — own + children
        db
          .select({
            week: sql<string>`to_char(date_trunc('week', start_time), 'YYYY-MM-DD')`,
            minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
          })
          .from(sessions)
          .where(
            and(
              inArray(sessions.project_id, allIds),
              isNotNull(sessions.end_time),
              gte(sessions.start_time, weeksAgo(4)),
            ),
          )
          .groupBy(sql`date_trunc('week', start_time)`)
          .orderBy(sql`date_trunc('week', start_time)`),

        // Tasks grouped by creation week — last 8 weeks — own project only
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

        // Time by day of week (all-time) — own + children
        db
          .select({
            dow: sql<number>`extract(dow from start_time)`,
            minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
          })
          .from(sessions)
          .where(and(inArray(sessions.project_id, allIds), isNotNull(sessions.end_time)))
          .groupBy(sql`extract(dow from start_time)`)
          .orderBy(sql`extract(dow from start_time)`),

        // Monthly — last 6 months — own + children
        db
          .select({
            month: sql<string>`to_char(start_time, 'YYYY-MM')`,
            sessions: sql<number>`count(*)`,
            minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
          })
          .from(sessions)
          .where(
            and(
              inArray(sessions.project_id, allIds),
              isNotNull(sessions.end_time),
              gte(sessions.start_time, weeksAgo(26)),
            ),
          )
          .groupBy(sql`to_char(start_time, 'YYYY-MM')`)
          .orderBy(sql`to_char(start_time, 'YYYY-MM')`),
      ]);

    // Per-child breakdown (only for parent projects)
    let childrenStats: { id: string; name: string; minutes: number; sessions: number }[] = [];
    if (isParent && childIds.length > 0) {
      const childRows = await db
        .select({
          project_id: sessions.project_id,
          minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
          session_count: sql<number>`count(*)`,
        })
        .from(sessions)
        .where(and(inArray(sessions.project_id, childIds), isNotNull(sessions.end_time)))
        .groupBy(sessions.project_id);

      const childMinMap = new Map(childRows.map((r) => [r.project_id, r]));
      childrenStats = childRels.map((rel) => {
        const row = childMinMap.get(rel.child_id);
        return {
          id: rel.child_id,
          name: rel.child_name ?? "",
          minutes: Number(row?.minutes ?? 0),
          sessions: Number(row?.session_count ?? 0),
        };
      });
    }

    const ts = taskStats[0];
    const total = Number(ts?.total ?? 0);
    const done = Number(ts?.done ?? 0);
    const inProgress = Number(ts?.in_progress ?? 0);

    // Build 4-week time series
    const sessionWeekMap = new Map(sessionWeekRows.map((r) => [r.week, Number(r.minutes)]));
    const timeByWeek = Array.from({ length: 4 }, (_, i) => {
      const ws = getWeekStart(3 - i);
      const key = localDateStr(ws);
      const label = ws.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      return { week: label, minutes: sessionWeekMap.get(key) ?? 0 };
    });

    // Build 8-week task series
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

    // Day of week (0=Sun … 6=Sat)
    const DOW = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const dowMap = new Map(dowRows.map((r) => [Number(r.dow), Number(r.minutes)]));
    const timeByDow = DOW.map((day, i) => ({ day, minutes: dowMap.get(i) ?? 0 }));

    return NextResponse.json({
      completion: {
        total,
        done,
        in_progress: inProgress,
        todo: total - done - inProgress,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
      },
      totalMinutes: Number(totalRow[0]?.minutes ?? 0),
      sessionCount: Number(totalRow[0]?.session_count ?? 0),
      isParent,
      children: childrenStats,
      timeByWeek,
      tasksByWeek,
      timeByDow,
      monthly: monthlyRows.map((r) => ({
        month: r.month,
        sessions: Number(r.sessions),
        minutes: Number(r.minutes),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
