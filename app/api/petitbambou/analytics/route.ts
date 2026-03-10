import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meditations } from "@/lib/schema";
import { sql, desc, isNotNull } from "drizzle-orm";

const DOW_LABELS: Record<number, string> = {
  0: "Dim",
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
};

export async function GET() {
  try {
    // byMonth
    const byMonthRows = await db.execute(sql`
      SELECT
        to_char(date, 'YYYY-MM') AS month,
        COUNT(*)::int AS count,
        SUM(duration_min::numeric)::int AS total_minutes,
        ROUND(AVG(duration_min::numeric))::int AS avg_duration
      FROM ${meditations}
      WHERE date IS NOT NULL
      GROUP BY to_char(date, 'YYYY-MM')
      ORDER BY month ASC
    `);

    const byMonth = (byMonthRows.rows as Array<{
      month: string;
      count: number;
      total_minutes: number;
      avg_duration: number;
    }>).map((r) => ({
      month: r.month,
      count: Number(r.count),
      total_minutes: Number(r.total_minutes),
      avg_duration: Number(r.avg_duration),
    }));

    // byDayOfWeek
    const byDowRows = await db.execute(sql`
      SELECT
        EXTRACT(DOW FROM date)::int AS dow,
        COUNT(*)::int AS count
      FROM ${meditations}
      WHERE date IS NOT NULL
      GROUP BY EXTRACT(DOW FROM date)
      ORDER BY dow ASC
    `);

    const byDayOfWeek = (byDowRows.rows as Array<{ dow: number; count: number }>).map((r) => ({
      dow: Number(r.dow),
      label: DOW_LABELS[Number(r.dow)] ?? String(r.dow),
      count: Number(r.count),
    }));

    // streakHistory
    const streakRows = await db
      .select({
        date: meditations.date,
        streak: meditations.streak,
      })
      .from(meditations)
      .where(isNotNull(meditations.date))
      .orderBy(meditations.date);

    const streakHistory = streakRows.map((r) => ({
      date: r.date ? r.date.toISOString().slice(0, 10) : null,
      streak: r.streak ?? 0,
    }));

    // topLessons
    const topLessonsRows = await db.execute(sql`
      SELECT
        lesson,
        COUNT(*)::int AS count
      FROM ${meditations}
      WHERE lesson IS NOT NULL
      GROUP BY lesson
      ORDER BY count DESC
      LIMIT 10
    `);

    const topLessons = (topLessonsRows.rows as Array<{ lesson: string; count: number }>).map((r) => ({
      lesson: r.lesson,
      count: Number(r.count),
    }));

    return NextResponse.json({ byMonth, byDayOfWeek, streakHistory, topLessons });
  } catch (err) {
    console.error("[petitbambou/analytics]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
