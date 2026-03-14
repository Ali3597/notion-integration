import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { journal_entries, journal_logs } from "@/lib/schema";
import { eq, desc, sql, or, ilike, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";

    // Build base query: entries with last log preview, log count, last review_date
    const rows = await db
      .select({
        id: journal_entries.id,
        title: journal_entries.title,
        pinned: journal_entries.pinned,
        created_at: journal_entries.created_at,
        updated_at: journal_entries.updated_at,
        log_count: sql<number>`(select count(*) from journal_logs jl where jl.entry_id = journal_entries.id)`,
        last_log_preview: sql<string | null>`(select content from journal_logs jl where jl.entry_id = journal_entries.id order by jl.created_at desc limit 1)`,
        review_date: sql<string | null>`(select review_date::text from journal_logs jl where jl.entry_id = journal_entries.id and jl.review_date is not null order by jl.created_at desc limit 1)`,
      })
      .from(journal_entries)
      .orderBy(
        sql`${journal_entries.pinned} desc`,
        desc(journal_entries.updated_at)
      );

    if (!search) {
      return NextResponse.json(rows);
    }

    // Filter client-side for simplicity (small dataset expected)
    const lower = search.toLowerCase();
    const filtered = rows.filter((r) =>
      r.title.toLowerCase().includes(lower) ||
      (r.last_log_preview ?? "").toLowerCase().includes(lower)
    );
    return NextResponse.json(filtered);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = (body.title ?? "Nouveau thread").trim() || "Nouveau thread";
    const [entry] = await db
      .insert(journal_entries)
      .values({ title })
      .returning();
    return NextResponse.json(entry);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.title === "string") updates.title = body.title.trim() || "Sans titre";
    if (typeof body.pinned === "boolean") updates.pinned = body.pinned;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
    }
    const [updated] = await db
      .update(journal_entries)
      .set(updates)
      .where(eq(journal_entries.id, id))
      .returning();
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await db.delete(journal_entries).where(eq(journal_entries.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
