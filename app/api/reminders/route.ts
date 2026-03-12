import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reminders } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doneParam = searchParams.get("done");

    const query = db.select().from(reminders);
    const items = doneParam === "true"
      ? await query.where(eq(reminders.done, true)).orderBy(sql`due_date ASC NULLS LAST, created_at ASC`)
      : doneParam === "false"
      ? await query.where(eq(reminders.done, false)).orderBy(sql`due_date ASC NULLS LAST, created_at ASC`)
      : await query.orderBy(sql`due_date ASC NULLS LAST, created_at ASC`);

    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, due_date } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const [item] = await db.insert(reminders).values({
      name: name.trim(),
      due_date: due_date || null,
    }).returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const body = await request.json();
    const updates: Partial<typeof reminders.$inferInsert> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.due_date !== undefined) updates.due_date = body.due_date || null;
    if (body.done !== undefined) updates.done = body.done;

    const [updated] = await db.update(reminders).set(updates).where(eq(reminders.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Rappel non trouvé" }, { status: 404 });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    await db.delete(reminders).where(eq(reminders.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
