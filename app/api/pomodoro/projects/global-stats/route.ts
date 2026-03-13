import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, sessions, projects } from "@/lib/schema";
import { eq, and, gte, isNotNull, sql } from "drizzle-orm";

export async function GET() {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const [kpiTasksRow, kpiProjectsRow, kpiMinutesRow, byProjectRows, heatmapRows, monthlyRows] =
      await Promise.all([
        // Task KPIs
        db
          .select({
            total_tasks: sql<number>`count(*)`,
            completed_tasks: sql<number>`count(*) filter (where status = 'Terminé')`,
          })
          .from(tasks),

        // Project KPIs
        db
          .select({
            total_projects: sql<number>`count(*)`,
            active_projects: sql<number>`count(*) filter (where status = 'En cours')`,
          })
          .from(projects),

        // Total minutes all time
        db
          .select({
            total_minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
            total_sessions: sql<number>`count(*)`,
          })
          .from(sessions)
          .where(isNotNull(sessions.end_time)),

        // Time and sessions per project (top 12 by minutes)
        db
          .select({
            id: projects.id,
            name: projects.name,
            status: projects.status,
            minutes: sql<number>`coalesce(round(sum(extract(epoch from (sessions.end_time - sessions.start_time)) / 60)), 0)`,
            session_count: sql<number>`count(sessions.id)`,
          })
          .from(projects)
          .leftJoin(
            sessions,
            and(eq(sessions.project_id, projects.id), isNotNull(sessions.end_time)),
          )
          .groupBy(projects.id, projects.name, projects.status)
          .orderBy(sql`coalesce(round(sum(extract(epoch from (sessions.end_time - sessions.start_time)) / 60)), 0) DESC`)
          .limit(12),

        // Heatmap — sessions per day over last 90 days
        db
          .select({
            date: sql<string>`to_char(start_time, 'YYYY-MM-DD')`,
            count: sql<number>`count(*)`,
            minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
          })
          .from(sessions)
          .where(
            and(
              isNotNull(sessions.end_time),
              gte(sessions.start_time, ninetyDaysAgo),
            ),
          )
          .groupBy(sql`to_char(start_time, 'YYYY-MM-DD')`)
          .orderBy(sql`to_char(start_time, 'YYYY-MM-DD')`),

        // Monthly activity — last 12 months
        db
          .select({
            month: sql<string>`to_char(start_time, 'YYYY-MM')`,
            sessions: sql<number>`count(*)`,
            minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
          })
          .from(sessions)
          .where(
            and(isNotNull(sessions.end_time), gte(sessions.start_time, twelveMonthsAgo)),
          )
          .groupBy(sql`to_char(start_time, 'YYYY-MM')`)
          .orderBy(sql`to_char(start_time, 'YYYY-MM')`),
      ]);

    const totalTasks = Number(kpiTasksRow[0]?.total_tasks ?? 0);
    const completedTasks = Number(kpiTasksRow[0]?.completed_tasks ?? 0);

    return NextResponse.json({
      kpis: {
        total_projects: Number(kpiProjectsRow[0]?.total_projects ?? 0),
        active_projects: Number(kpiProjectsRow[0]?.active_projects ?? 0),
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        completion_pct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        total_minutes: Number(kpiMinutesRow[0]?.total_minutes ?? 0),
        total_sessions: Number(kpiMinutesRow[0]?.total_sessions ?? 0),
      },
      byProject: byProjectRows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        minutes: Number(r.minutes),
        sessions: Number(r.session_count),
      })),
      heatmap: heatmapRows.map((r) => ({
        date: r.date,
        count: Number(r.count),
        minutes: Number(r.minutes),
      })),
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
