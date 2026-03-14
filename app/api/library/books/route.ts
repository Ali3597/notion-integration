import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, authors, genres, series, book_notes } from "@/lib/schema";
import { eq, sql, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const genreId = searchParams.get("genre_id");
    const authorId = searchParams.get("author_id");
    const serieId = searchParams.get("serie_id");

    const conditions = [];
    if (statusParam) conditions.push(eq(books.status, statusParam));
    if (genreId) conditions.push(eq(books.genre_id, genreId));
    if (authorId) conditions.push(eq(books.author_id, authorId));
    if (serieId) conditions.push(eq(books.serie_id, serieId));

    const rows = await db
      .select({
        id: books.id,
        title: books.title,
        author_id: books.author_id,
        author_name: authors.name,
        genre_id: books.genre_id,
        genre_name: genres.name,
        serie_id: books.serie_id,
        serie_name: series.name,
        status: books.status,
        rating: books.rating,
        image_url: books.image_url,
        started_at: books.started_at,
        finished_at: books.finished_at,
        created_at: books.created_at,
        note_count: sql<number>`(select count(*) from book_notes where book_notes.book_id = ${books.id})`,
      })
      .from(books)
      .leftJoin(authors, eq(books.author_id, authors.id))
      .leftJoin(genres, eq(books.genre_id, genres.id))
      .leftJoin(series, eq(books.serie_id, series.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${books.started_at} DESC NULLS LAST`);

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, author_id, genre_id, serie_id, status, rating, image_url, started_at, finished_at } = body;
    if (!title?.trim()) return NextResponse.json({ error: "Le titre est requis" }, { status: 400 });

    const effectiveStatus: string = status || "Pas Lu";
    if (effectiveStatus === "En cours" && !started_at) {
      return NextResponse.json({ error: "La date de début est requise pour un livre en cours" }, { status: 400 });
    }

    const [book] = await db.insert(books).values({
      title: title.trim(),
      author_id: author_id || null,
      genre_id: genre_id || null,
      serie_id: serie_id || null,
      status: effectiveStatus,
      rating: rating ?? null,
      image_url: image_url || null,
      started_at: (effectiveStatus === "Souhait" || effectiveStatus === "Pas Lu") ? null : (started_at || null),
      finished_at: (effectiveStatus === "Souhait" || effectiveStatus === "Pas Lu" || effectiveStatus === "En cours") ? null : (finished_at || null),
    }).returning();

    return NextResponse.json(book, { status: 201 });
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
    const updates: Partial<typeof books.$inferInsert> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.author_id !== undefined) updates.author_id = body.author_id || null;
    if (body.genre_id !== undefined) updates.genre_id = body.genre_id || null;
    if (body.serie_id !== undefined) updates.serie_id = body.serie_id || null;
    if (body.status !== undefined) updates.status = body.status;
    if (body.rating !== undefined) updates.rating = body.rating ?? null;
    if (body.image_url !== undefined) updates.image_url = body.image_url || null;
    if (body.started_at !== undefined) updates.started_at = body.started_at || null;
    if (body.finished_at !== undefined) updates.finished_at = body.finished_at || null;

    // Server-side status/date enforcement
    if (updates.status === "Souhait" || updates.status === "Pas Lu") {
      updates.started_at = null;
      updates.finished_at = null;
    } else if (updates.status === "En cours") {
      updates.finished_at = null;
    }

    const [updated] = await db.update(books).set(updates).where(eq(books.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Livre non trouvé" }, { status: 404 });

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

    await db.delete(books).where(eq(books.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
