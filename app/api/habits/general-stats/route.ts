import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { habits, habit_logs } from "@/lib/schema";
import { and, gte, eq } from "drizzle-orm";

function ldate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

// GET /api/habits/general-stats
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff90 = new Date(today);
    cutoff90.setDate(cutoff90.getDate() - 89);
    const cutoff90Str = ldate(cutoff90);

    const cutoff30 = new Date(today);
    cutoff30.setDate(cutoff30.getDate() - 29);
    const cutoff30Str = ldate(cutoff30);

    // Load all active habits
    const allHabits = await db.select().from(habits).where(eq(habits.active, true));

    if (allHabits.length === 0) {
      return NextResponse.json({
        globalRate30d: 0,
        bestDayOfWeek: null,
        mostRegularHabit: null,
        leastRegularHabit: null,
        dailyRates30d: [],
        byDayOfWeek: [],
        habitRanking: [],
        heatmap90d: [],
      });
    }

    // Load all logs for last 90 days
    const logs = await db
      .select({ habit_id: habit_logs.habit_id, completed_date: habit_logs.completed_date })
      .from(habit_logs)
      .where(gte(habit_logs.completed_date, cutoff90Str));

    // Index logs: set of "habit_id:date"
    const logSet = new Set(logs.map((l) => `${l.habit_id}:${l.completed_date}`));

    // Build per-day data for 90 days
    const days90: { date: string; dueCount: number; doneCount: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = ldate(d);

      let dueCount = 0;
      let doneCount = 0;
      for (const habit of allHabits) {
        if (isHabitDue(habit, d)) {
          dueCount++;
          if (logSet.has(`${habit.id}:${dateStr}`)) doneCount++;
        }
      }
      days90.push({ date: dateStr, dueCount, doneCount });
    }

    // Last 30 days slice
    const days30 = days90.slice(60); // last 30 of 90

    // Global completion rate over 30 days
    const totalDue30 = days30.reduce((s, d) => s + d.dueCount, 0);
    const totalDone30 = days30.reduce((s, d) => s + d.doneCount, 0);
    const globalRate30d = totalDue30 > 0 ? Math.round((totalDone30 / totalDue30) * 100) : 0;

    // Daily rates for last 30 days
    const dailyRates30d = days30.map((d) => ({
      date: d.date,
      rate: d.dueCount > 0 ? Math.round((d.doneCount / d.dueCount) * 100) : 0,
      done: d.doneCount,
      due: d.dueCount,
    }));

    // By day of week (0=Mon … 6=Sun using ISO convention in display)
    // We'll group by JS getDay(): 0=Sun,1=Mon,...,6=Sat, then reorder to Mon-Sun
    const dowMap = Array(7).fill(0).map(() => ({ done: 0, due: 0 }));
    for (const d of days90) {
      const dow = new Date(d.date + "T00:00:00").getDay(); // 0=Sun
      dowMap[dow].done += d.doneCount;
      dowMap[dow].due += d.dueCount;
    }
    const DOW_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    // Reorder Mon→Sun: indices 1,2,3,4,5,6,0
    const dowOrder = [1, 2, 3, 4, 5, 6, 0];
    const byDayOfWeek = dowOrder.map((i) => ({
      label: DOW_LABELS[i],
      done: dowMap[i].done,
      due: dowMap[i].due,
      rate: dowMap[i].due > 0 ? Math.round((dowMap[i].done / dowMap[i].due) * 100) : 0,
    }));

    // Best day of week
    const bestDow = byDayOfWeek.reduce((best, d) => (d.rate > best.rate ? d : best), byDayOfWeek[0]);
    const bestDayOfWeek = bestDow.due > 0 ? bestDow.label : null;

    // Per-habit stats over 30 days + current streak
    const habitRanking = allHabits.map((habit) => {
      // 30d rate
      let due30 = 0;
      let done30 = 0;
      for (const d of days30) {
        const date = new Date(d.date + "T00:00:00");
        if (isHabitDue(habit, date)) {
          due30++;
          if (logSet.has(`${habit.id}:${d.date}`)) done30++;
        }
      }
      const rate30d = due30 > 0 ? Math.round((done30 / due30) * 100) : 0;

      // Current streak: walk backward from today
      let streak = 0;
      for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = ldate(d);
        // Skip today if not yet completed
        if (i === 0 && !logSet.has(`${habit.id}:${dateStr}`)) continue;
        if (!isHabitDue(habit, d)) continue;
        if (logSet.has(`${habit.id}:${dateStr}`)) {
          streak++;
        } else {
          break;
        }
      }

      return {
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        rate30d,
        streak,
        due30,
      };
    }).sort((a, b) => b.rate30d - a.rate30d);

    // Most/least regular
    const habitsWithDue = habitRanking.filter((h) => h.due30 > 0);
    const mostRegularHabit = habitsWithDue.length > 0
      ? { name: habitsWithDue[0].name, icon: habitsWithDue[0].icon, streak: habitsWithDue[0].streak }
      : null;
    // Best streak among all
    const maxStreak = habitRanking.reduce((best, h) => (h.streak > best.streak ? h : best), habitRanking[0]);
    const mostRegularByStreak = maxStreak.streak > 0
      ? { name: maxStreak.name, icon: maxStreak.icon, streak: maxStreak.streak }
      : null;

    const leastRegularHabit = habitsWithDue.length > 0
      ? { name: habitsWithDue[habitsWithDue.length - 1].name, icon: habitsWithDue[habitsWithDue.length - 1].icon, rate: habitsWithDue[habitsWithDue.length - 1].rate30d }
      : null;

    // Heatmap for 90 days
    const heatmap90d = days90.map((d) => ({
      date: d.date,
      done: d.doneCount,
      total: d.dueCount,
      rate: d.dueCount > 0 ? Math.round((d.doneCount / d.dueCount) * 100) : 0,
    }));

    return NextResponse.json({
      globalRate30d,
      bestDayOfWeek,
      mostRegularHabit: mostRegularByStreak,
      leastRegularHabit,
      dailyRates30d,
      byDayOfWeek,
      habitRanking,
      heatmap90d,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
