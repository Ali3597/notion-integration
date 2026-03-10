import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks, sessions, meditations } from "@/lib/schema";
import { eq, gte, sql, desc } from "drizzle-orm";

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      projectStats,
      taskStats,
      todaySessionStats,
      lastMeditation,
    ] = await Promise.all([
      db.select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where status = 'En cours')`,
      }).from(projects),
      db.select({
        total: sql<number>`count(*)`,
        in_progress: sql<number>`count(*) filter (where status = 'En cours')`,
      }).from(tasks),
      db.select({
        session_count: sql<number>`count(*)`,
        total_minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
      }).from(sessions).where(gte(sessions.start_time, todayStart)),
      db.select({
        lesson: meditations.lesson,
        date: meditations.date,
        streak: meditations.streak,
      }).from(meditations).orderBy(desc(meditations.date)).limit(1),
    ]);

    return NextResponse.json({
      projects: projectStats[0],
      tasks: taskStats[0],
      today: todaySessionStats[0],
      lastMeditation: lastMeditation[0] ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
