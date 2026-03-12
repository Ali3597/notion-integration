import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authors, books } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: authors.id,
        name: authors.name,
        photo_url: authors.photo_url,
        created_at: authors.created_at,
        book_count: sql<number>`(select count(*) from books where books.author_id = ${authors.id})`,
      })
      .from(authors)
      .orderBy(authors.name);

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, photo_url } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const [author] = await db.insert(authors).values({
      name: name.trim(),
      photo_url: photo_url || null,
    }).returning();

    return NextResponse.json(author, { status: 201 });
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
    const updates: Partial<typeof authors.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.photo_url !== undefined) updates.photo_url = body.photo_url || null;

    const [updated] = await db.update(authors).set(updates).where(eq(authors.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Auteur non trouvé" }, { status: 404 });

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

    await db.delete(authors).where(eq(authors.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
