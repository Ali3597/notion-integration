import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { journal_logs, journal_entries } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const entry_id = req.nextUrl.searchParams.get("entry_id");
    if (!entry_id) return NextResponse.json({ error: "entry_id requis" }, { status: 400 });
    const logs = await db
      .select()
      .from(journal_logs)
      .where(eq(journal_logs.entry_id, entry_id))
      .orderBy(asc(journal_logs.created_at));
    return NextResponse.json(logs);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entry_id, content, review_date } = body;
    if (!entry_id || !content?.trim()) {
      return NextResponse.json({ error: "entry_id et content requis" }, { status: 400 });
    }
    const [log] = await db
      .insert(journal_logs)
      .values({
        entry_id,
        content: content.trim(),
        review_date: review_date || null,
      })
      .returning();

    // Update parent updated_at
    await db
      .update(journal_entries)
      .set({ updated_at: new Date() })
      .where(eq(journal_entries.id, entry_id));

    return NextResponse.json(log);
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
    if (typeof body.content === "string") updates.content = body.content.trim();
    if ("review_date" in body) updates.review_date = body.review_date || null;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
    }
    const [updated] = await db
      .update(journal_logs)
      .set(updates)
      .where(eq(journal_logs.id, id))
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
    await db.delete(journal_logs).where(eq(journal_logs.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
