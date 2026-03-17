import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { birthdays } from "@/lib/schema";
import { eq } from "drizzle-orm";

function getNextOccurrence(birthDate: string): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [, monthStr, dayStr] = birthDate.split("-");
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const thisYear = new Date(today.getFullYear(), month, day);
  if (thisYear >= today) return thisYear;
  return new Date(today.getFullYear() + 1, month, day);
}

export async function GET() {
  try {
    const items = await db.select().from(birthdays);
    const sorted = items.sort((a, b) => {
      return getNextOccurrence(a.birth_date).getTime() - getNextOccurrence(b.birth_date).getTime();
    });
    return NextResponse.json(sorted);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, birth_date, year_known, note } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    if (!birth_date) return NextResponse.json({ error: "La date est requise" }, { status: 400 });

    const [item] = await db.insert(birthdays).values({
      name: name.trim(),
      birth_date,
      year_known: year_known !== false,
      note: note || null,
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
    const updates: Partial<typeof birthdays.$inferInsert> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.birth_date !== undefined) updates.birth_date = body.birth_date;
    if (body.year_known !== undefined) updates.year_known = body.year_known;
    if (body.note !== undefined) updates.note = body.note || null;

    const [updated] = await db.update(birthdays).set(updates).where(eq(birthdays.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Anniversaire non trouvé" }, { status: 404 });

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

    await db.delete(birthdays).where(eq(birthdays.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
