import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { genres, books } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: genres.id,
        name: genres.name,
        icon: genres.icon,
        created_at: genres.created_at,
        book_count: sql<number>`(select count(*) from books where books.genre_id = ${genres.id})`,
      })
      .from(genres)
      .orderBy(genres.name);

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const { icon } = body;
    const [genre] = await db.insert(genres).values({ name: name.trim(), icon: icon || null }).returning();
    return NextResponse.json(genre, { status: 201 });
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
    if (!body.name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const updates: Partial<typeof genres.$inferInsert> = { name: body.name.trim() };
    if (body.icon !== undefined) updates.icon = body.icon || null;
    const [updated] = await db.update(genres).set(updates).where(eq(genres.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Genre non trouvé" }, { status: 404 });

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

    await db.delete(genres).where(eq(genres.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
