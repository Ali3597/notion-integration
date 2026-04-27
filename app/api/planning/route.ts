import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { planning_blocks, projects, reminders, habits } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const day = req.nextUrl.searchParams.get("day");
  if (!day) return NextResponse.json({ error: "Missing day" }, { status: 400 });

  try {
    const rows = await db
      .select({
        id: planning_blocks.id,
        day: planning_blocks.day,
        start_time: planning_blocks.start_time,
        end_time: planning_blocks.end_time,
        title: planning_blocks.title,
        status: planning_blocks.status,
        notes: planning_blocks.notes,
        project_id: planning_blocks.project_id,
        reminder_id: planning_blocks.reminder_id,
        habit_id: planning_blocks.habit_id,
        created_at: planning_blocks.created_at,
        project_name: projects.name,
        project_status: projects.status,
        reminder_name: reminders.name,
        habit_name: habits.name,
        habit_icon: habits.icon,
        habit_color: habits.color,
      })
      .from(planning_blocks)
      .leftJoin(projects, eq(planning_blocks.project_id, projects.id))
      .leftJoin(reminders, eq(planning_blocks.reminder_id, reminders.id))
      .leftJoin(habits, eq(planning_blocks.habit_id, habits.id))
      .where(eq(planning_blocks.day, day))
      .orderBy(asc(planning_blocks.start_time));

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { day, start_time, end_time, title, notes, project_id, reminder_id, habit_id } = body;

    if (!day || !start_time || !end_time || !title?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [block] = await db
      .insert(planning_blocks)
      .values({
        day,
        start_time,
        end_time,
        title: title.trim(),
        notes: notes || null,
        project_id: project_id || null,
        reminder_id: reminder_id || null,
        habit_id: habit_id || null,
      })
      .returning();

    return NextResponse.json(block);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const body = await req.json();
    const updates: {
      day?: string;
      start_time?: string;
      end_time?: string;
      title?: string;
      status?: string | null;
      notes?: string | null;
      project_id?: string | null;
      reminder_id?: string | null;
      habit_id?: string | null;
    } = {};

    if (body.day !== undefined) updates.day = body.day;
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.title !== undefined) updates.title = body.title.trim();
    if ("status" in body) updates.status = body.status ?? null;
    if ("notes" in body) updates.notes = body.notes || null;
    if ("project_id" in body) updates.project_id = body.project_id || null;
    if ("reminder_id" in body) updates.reminder_id = body.reminder_id || null;
    if ("habit_id" in body) updates.habit_id = body.habit_id || null;

    const [updated] = await db
      .update(planning_blocks)
      .set(updates)
      .where(eq(planning_blocks.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await db.delete(planning_blocks).where(eq(planning_blocks.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
