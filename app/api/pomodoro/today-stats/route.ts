import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/schema";
import { sql, gte } from "drizzle-orm";

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [row] = await db
      .select({
        session_count: sql<number>`count(*)`,
        total_minutes: sql<number>`coalesce(round(sum(extract(epoch from (${sessions.end_time} - ${sessions.start_time})) / 60)), 0)`,
      })
      .from(sessions)
      .where(gte(sessions.start_time, todayStart));

    return NextResponse.json(row);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
