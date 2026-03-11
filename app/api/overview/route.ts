import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks, sessions, meditations, shopping_items } from "@/lib/schema";
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
      shoppingStats,
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
      db.select({
        total: sql<number>`count(*)`,
        remaining_budget: sql<number>`coalesce(sum(estimated_price) filter (where purchased = false), 0)`,
        to_buy: sql<number>`count(*) filter (where purchased = false)`,
      }).from(shopping_items),
    ]);

    return NextResponse.json({
      projects: projectStats[0],
      tasks: taskStats[0],
      today: todaySessionStats[0],
      lastMeditation: lastMeditation[0] ?? null,
      shopping: shoppingStats[0],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
