import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { habits, habit_logs } from "@/lib/schema";
import { and, eq, gte } from "drizzle-orm";

// Returns detailed stats for a single habit (charts data)
// GET ?id=<habit_id>&days=90

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const days = parseInt(searchParams.get("days") || "90", 10);

    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const [habit] = await db.select().from(habits).where(eq(habits.id, id));
    if (!habit) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const logs = await db
      .select({ completed_date: habit_logs.completed_date })
      .from(habit_logs)
      .where(and(eq(habit_logs.habit_id, id), gte(habit_logs.completed_date, cutoffStr)));

    const logSet = new Set(logs.map((l) => l.completed_date));

    // Build per-day data for heatmap (last `days` days)
    const heatmap: { date: string; done: boolean; due: boolean }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const due = isHabitDue(habit, d);
      heatmap.push({ date: dateStr, done: logSet.has(dateStr), due });
    }

    // By day of week (0=Sun…6=Sat → remap to 1=Mon…7=Sun)
    const byDow = Array(7).fill(0).map((_, i) => ({ day: i, done: 0, due: 0 }));
    for (const entry of heatmap) {
      const dow = new Date(entry.date + "T00:00:00").getDay();
      if (entry.due) byDow[dow].due++;
      if (entry.done) byDow[dow].done++;
    }
    const DOW_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const byDayOfWeek = byDow.map((d) => ({
      label: DOW_LABELS[d.day],
      done: d.done,
      due: d.due,
      rate: d.due > 0 ? Math.round((d.done / d.due) * 100) : 0,
    }));

    // By month (last 6 months)
    const byMonthMap = new Map<string, { done: number; due: number }>();
    for (const entry of heatmap) {
      const month = entry.date.slice(0, 7);
      if (!byMonthMap.has(month)) byMonthMap.set(month, { done: 0, due: 0 });
      const m = byMonthMap.get(month)!;
      if (entry.due) m.due++;
      if (entry.done) m.done++;
    }
    const byMonth = Array.from(byMonthMap.entries())
      .slice(-6)
      .map(([month, { done, due }]) => ({
        month,
        done,
        due,
        rate: due > 0 ? Math.round((done / due) * 100) : 0,
      }));

    // Running streak history (last 30 days)
    const streakHistory: { date: string; streak: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      // Count consecutive days before this date
      let streak = 0;
      for (let j = i; j < days; j++) {
        const prev = new Date(today);
        prev.setDate(prev.getDate() - j);
        const prevStr = prev.toISOString().split("T")[0];
        if (isHabitDue(habit, prev) && logSet.has(prevStr)) streak++;
        else if (isHabitDue(habit, prev)) break;
      }
      streakHistory.push({ date: dateStr, streak });
    }

    return NextResponse.json({ habit, heatmap, byDayOfWeek, byMonth, streakHistory });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

function isHabitDue(
  habit: { frequency_type: string; frequency_days: string | null },
  date: Date
): boolean {
  const isoDay = date.getDay() === 0 ? 7 : date.getDay();
  switch (habit.frequency_type) {
    case "daily": return true;
    case "specific_days": {
      const days: number[] = JSON.parse(habit.frequency_days || "[]");
      return days.includes(isoDay);
    }
    case "weekly": return true;
    case "monthly": {
      const day = parseInt(habit.frequency_days || "1", 10);
      return date.getDate() === day;
    }
    default: return false;
  }
}
