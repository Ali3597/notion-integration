import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { habit_logs } from "@/lib/schema";
import { and, eq, gte, lte } from "drizzle-orm";

// ── GET — logs in date range ──────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const habit_id = searchParams.get("habit_id");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [];
    if (habit_id) conditions.push(eq(habit_logs.habit_id, habit_id));
    if (from) conditions.push(gte(habit_logs.completed_date, from));
    if (to) conditions.push(lte(habit_logs.completed_date, to));

    const logs = await db
      .select()
      .from(habit_logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(habit_logs.completed_date);

    return NextResponse.json(logs);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// ── POST — log a habit ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { habit_id, completed_date, note } = body;

    if (!habit_id) return NextResponse.json({ error: "habit_id requis" }, { status: 400 });
    if (!completed_date) return NextResponse.json({ error: "completed_date requis" }, { status: 400 });

    // Upsert — unique constraint on (habit_id, completed_date)
    const [log] = await db
      .insert(habit_logs)
      .values({ habit_id, completed_date, note: note ?? null })
      .onConflictDoUpdate({
        target: [habit_logs.habit_id, habit_logs.completed_date],
        set: { note: note ?? null },
      })
      .returning();

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// ── DELETE — unlog a habit for a date ────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const habit_id = searchParams.get("habit_id");
    const date = searchParams.get("date");

    if (!habit_id || !date) {
      return NextResponse.json({ error: "habit_id et date requis" }, { status: 400 });
    }

    await db
      .delete(habit_logs)
      .where(and(eq(habit_logs.habit_id, habit_id), eq(habit_logs.completed_date, date)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
