import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { series, authors, books } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: series.id,
        name: series.name,
        author_id: series.author_id,
        author_name: authors.name,
        status: series.status,
        created_at: series.created_at,
        book_count: sql<number>`(select count(*) from books where books.serie_id = ${series.id})`,
      })
      .from(series)
      .leftJoin(authors, eq(series.author_id, authors.id))
      .orderBy(series.name);

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, author_id, status } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const [serie] = await db.insert(series).values({
      name: name.trim(),
      author_id: author_id || null,
      status: status || null,
    }).returning();

    return NextResponse.json(serie, { status: 201 });
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
    const updates: Partial<typeof series.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.author_id !== undefined) updates.author_id = body.author_id || null;
    if (body.status !== undefined) updates.status = body.status || null;

    const [updated] = await db.update(series).set(updates).where(eq(series.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Série non trouvée" }, { status: 404 });

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

    await db.delete(series).where(eq(series.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
