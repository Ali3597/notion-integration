import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/petitbambou";
import { db } from "@/lib/db";
import { meditations } from "@/lib/schema";
import { desc, sql, max } from "drizzle-orm";

export async function GET() {
  try {
    const [pbMetrics, dbStats, recentRows] = await Promise.all([
      getMetrics(),
      db
        .select({
          total_sessions: sql<number>`count(*)`,
          total_minutes: sql<number>`coalesce(sum(${meditations.duration_min}), 0)`,
          best_streak: sql<number>`coalesce(max(${meditations.streak}), 0)`,
          current_streak: sql<number>`coalesce((
            select streak from meditations
            order by date desc
            limit 1
          ), 0)`,
        })
        .from(meditations),
      db
        .select({
          id: meditations.id,
          lesson: meditations.lesson,
          date: meditations.date,
          duration_min: meditations.duration_min,
          pb_uuid: meditations.pb_uuid,
          streak: meditations.streak,
        })
        .from(meditations)
        .orderBy(desc(meditations.date))
        .limit(10),
    ]);

    return NextResponse.json({
      metrics: pbMetrics,
      dbStats: dbStats[0],
      recentSessions: recentRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[petitbambou/stats]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
