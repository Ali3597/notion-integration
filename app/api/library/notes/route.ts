import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { book_notes, books } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get("book_id");

    const query = db
      .select({
        id: book_notes.id,
        title: book_notes.title,
        book_id: book_notes.book_id,
        book_title: books.title,
        content: book_notes.content,
        created_at: book_notes.created_at,
      })
      .from(book_notes)
      .leftJoin(books, eq(book_notes.book_id, books.id));

    const rows = bookId
      ? await query.where(eq(book_notes.book_id, bookId)).orderBy(sql`${book_notes.created_at} DESC`)
      : await query.orderBy(sql`${book_notes.created_at} DESC`);

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, book_id, content } = body;
    if (!title?.trim()) return NextResponse.json({ error: "Le titre est requis" }, { status: 400 });
    if (!book_id) return NextResponse.json({ error: "book_id requis" }, { status: 400 });

    const [note] = await db.insert(book_notes).values({
      title: title.trim(),
      book_id,
      content: content || null,
    }).returning();

    return NextResponse.json(note, { status: 201 });
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
    const updates: Partial<typeof book_notes.$inferInsert> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content || null;
    if (body.book_id !== undefined) updates.book_id = body.book_id;

    const [updated] = await db.update(book_notes).set(updates).where(eq(book_notes.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Note non trouvée" }, { status: 404 });

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

    await db.delete(book_notes).where(eq(book_notes.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
