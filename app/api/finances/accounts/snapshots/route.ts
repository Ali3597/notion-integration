import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_account_snapshots } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const account_id = searchParams.get("account_id");
    if (!account_id) return NextResponse.json({ error: "account_id requis" }, { status: 400 });

    const rows = await db
      .select()
      .from(finance_account_snapshots)
      .where(eq(finance_account_snapshots.account_id, account_id))
      .orderBy(desc(finance_account_snapshots.date), desc(finance_account_snapshots.created_at));

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { account_id, balance, date, note } = body;
    if (!account_id) return NextResponse.json({ error: "account_id requis" }, { status: 400 });
    if (balance === undefined || isNaN(parseFloat(balance))) return NextResponse.json({ error: "balance requis" }, { status: 400 });
    if (!date) return NextResponse.json({ error: "date requise" }, { status: 400 });

    const [snap] = await db.insert(finance_account_snapshots).values({
      account_id,
      balance: String(parseFloat(balance).toFixed(2)),
      date,
      note: note ?? null,
    }).returning();
    return NextResponse.json(snap, { status: 201 });
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
    const updates: Partial<typeof finance_account_snapshots.$inferInsert> = {};
    if (body.balance !== undefined) updates.balance = String(parseFloat(body.balance).toFixed(2));
    if (body.date !== undefined) updates.date = body.date;
    if (body.note !== undefined) updates.note = body.note;

    const [updated] = await db.update(finance_account_snapshots).set(updates).where(eq(finance_account_snapshots.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Snapshot non trouvé" }, { status: 404 });
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

    await db.delete(finance_account_snapshots).where(eq(finance_account_snapshots.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
