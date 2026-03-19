import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { weight_entries } from "@/lib/schema";
import { desc, gte, lte, and, eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

    const conditions = [];
    if (from) conditions.push(gte(weight_entries.measured_at, new Date(from)));
    if (to) conditions.push(lte(weight_entries.measured_at, new Date(to)));

    let query = db
      .select()
      .from(weight_entries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(weight_entries.measured_at));

    if (limit) query = query.limit(limit) as typeof query;

    return NextResponse.json(await query);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await db.delete(weight_entries).where(eq(weight_entries.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
