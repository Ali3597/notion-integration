import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { habits, habit_logs } from "@/lib/schema";
import { eq, gte } from "drizzle-orm";

// GET — 90-day overview grid for all active habits
// Returns: { habits: [...], dates: string[], grid: { [habit_id]: Set<date> } }

function ldate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 89); // 90 days inclusive
    const cutoffStr = ldate(cutoff);
    const todayStr = ldate(today);

    const activeHabits = await db
      .select()
      .from(habits)
      .where(eq(habits.active, true))
      .orderBy(habits.created_at);

    const allLogs = await db
      .select({ habit_id: habit_logs.habit_id, completed_date: habit_logs.completed_date })
      .from(habit_logs)
      .where(gte(habit_logs.completed_date, cutoffStr));

    // Build date range array
    const dates: string[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(ldate(d));
    }

    // Build log map
    const logMap = new Map<string, Set<string>>();
    for (const log of allLogs) {
      if (!logMap.has(log.habit_id)) logMap.set(log.habit_id, new Set());
      logMap.get(log.habit_id)!.add(log.completed_date);
    }

    // Serialize grid as { habit_id: string[] }
    const grid: Record<string, string[]> = {};
    for (const habit of activeHabits) {
      grid[habit.id] = Array.from(logMap.get(habit.id) || []);
    }

    return NextResponse.json({ habits: activeHabits, dates, grid, today: todayStr });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
