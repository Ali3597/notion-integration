import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { habits, habit_logs } from "@/lib/schema";
import { eq, gte } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ldate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Business logic ────────────────────────────────────────────────────────────

function getISODay(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay(); // 1=Mon … 7=Sun
}

function isHabitDue(
  habit: { frequency_type: string; frequency_days: string | null },
  date: Date
): boolean {
  switch (habit.frequency_type) {
    case "daily":
      return true;
    case "specific_days": {
      const days: number[] = JSON.parse(habit.frequency_days || "[]");
      return days.includes(getISODay(date));
    }
    case "weekly":
      return true; // any day, target tracked per week
    case "monthly": {
      const day = parseInt(habit.frequency_days || "1", 10);
      return date.getDate() === day;
    }
    default:
      return false;
  }
}

function computeStreaks(
  habit: { frequency_type: string; frequency_days: string | null; target_per_period: number | null; created_at: Date | null },
  logDates: string[]
): { current: number; best: number } {
  const logSet = new Set(logDates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = ldate(today);
  const createdAt = habit.created_at ? new Date(habit.created_at) : new Date(0);

  if (habit.frequency_type === "weekly") {
    const target = habit.target_per_period || 1;
    // Get Monday of current week
    const todayCopy = new Date(today);
    const todayDow = todayCopy.getDay() === 0 ? 6 : todayCopy.getDay() - 1;
    todayCopy.setDate(todayCopy.getDate() - todayDow);

    let current = 0;
    let best = 0;
    let temp = 0;
    let currentWeekInProgress = false;

    for (let w = 0; w < 52; w++) {
      const weekStart = new Date(todayCopy);
      weekStart.setDate(todayCopy.getDate() - w * 7);
      let count = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        if (logSet.has(ldate(day))) count++;
      }
      if (w === 0 && count < target) {
        currentWeekInProgress = true;
        continue;
      }
      if (count >= target) {
        temp++;
        best = Math.max(best, temp);
        if (!currentWeekInProgress || w === 1) current = temp;
      } else {
        temp = 0;
        if (w > 0) break;
      }
    }
    return { current, best };
  }

  // daily, specific_days, monthly — streak in days
  const dueDates: string[] = [];
  for (let i = 0; i < 400; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (d < createdAt) break;
    if (isHabitDue(habit, d)) dueDates.push(ldate(d));
  }

  const todayIsDue = dueDates[0] === todayStr;
  const todayDone = logSet.has(todayStr);
  const startIdx = todayIsDue && !todayDone ? 1 : 0;

  let current = 0;
  for (let i = startIdx; i < dueDates.length; i++) {
    if (logSet.has(dueDates[i])) current++;
    else break;
  }

  let best = current;
  let temp = 0;
  for (let i = dueDates.length - 1; i >= 0; i--) {
    if (logSet.has(dueDates[i])) { temp++; best = Math.max(best, temp); }
    else temp = 0;
  }

  return { current, best };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = ldate(today);

    const activeHabits = await db
      .select()
      .from(habits)
      .where(eq(habits.active, true))
      .orderBy(habits.created_at);

    if (activeHabits.length === 0) return NextResponse.json([]);

    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 400);
    const cutoffStr = ldate(cutoff);

    const allLogs = await db
      .select({ habit_id: habit_logs.habit_id, completed_date: habit_logs.completed_date })
      .from(habit_logs)
      .where(gte(habit_logs.completed_date, cutoffStr));

    const logsByHabit = new Map<string, string[]>();
    for (const log of allLogs) {
      if (!logsByHabit.has(log.habit_id)) logsByHabit.set(log.habit_id, []);
      logsByHabit.get(log.habit_id)!.push(log.completed_date);
    }

    const weekStart = new Date(today);
    const dow = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1;
    weekStart.setDate(weekStart.getDate() - dow);
    const weekStartStr = ldate(weekStart);

    const result = activeHabits.map((habit) => {
      const logs = logsByHabit.get(habit.id) || [];
      const logSet = new Set(logs);
      const completed_today = logSet.has(todayStr);
      const { current: current_streak, best: best_streak } = computeStreaks(habit, logs);
      const logs_this_week = logs.filter((d) => d >= weekStartStr).length;

      const dueDates30: string[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        if (isHabitDue(habit, d)) dueDates30.push(ldate(d));
      }
      const completedIn30 = dueDates30.filter((d) => logSet.has(d)).length;
      const completion_rate_30d =
        dueDates30.length > 0 ? Math.round((completedIn30 / dueDates30.length) * 100) : 0;

      return { ...habit, completed_today, current_streak, best_streak, completion_rate_30d, logs_this_week };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, icon, color, frequency_type, frequency_days, target_per_period } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    if (!frequency_type) return NextResponse.json({ error: "La fréquence est requise" }, { status: 400 });

    const [habit] = await db.insert(habits).values({
      name: name.trim(),
      description: description || null,
      icon: icon || null,
      color: color || null,
      frequency_type,
      frequency_days: frequency_days ?? null,
      target_per_period: target_per_period ?? 1,
    }).returning();

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const body = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    const fields = ["name", "description", "icon", "color", "frequency_type", "frequency_days", "target_per_period", "active", "archived_at"];
    for (const f of fields) if (body[f] !== undefined) updates[f] = body[f];

    const [updated] = await db.update(habits).set(updates).where(eq(habits.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await db.delete(habits).where(eq(habits.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
