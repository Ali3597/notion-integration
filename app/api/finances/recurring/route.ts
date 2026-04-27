import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_recurring, finance_categories } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: finance_recurring.id,
        name: finance_recurring.name,
        amount: finance_recurring.amount,
        type: finance_recurring.type,
        day_of_month: finance_recurring.day_of_month,
        active: finance_recurring.active,
        notes: finance_recurring.notes,
        created_at: finance_recurring.created_at,
        category_id: finance_categories.id,
        category_name: finance_categories.name,
        category_color: finance_categories.color,
        category_icon: finance_categories.icon,
      })
      .from(finance_recurring)
      .leftJoin(finance_categories, eq(finance_recurring.category_id, finance_categories.id))
      .orderBy(finance_recurring.type, finance_recurring.name);
    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, amount, type, category_id, day_of_month, notes } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    if (!amount || isNaN(parseFloat(amount))) return NextResponse.json({ error: "Le montant est requis" }, { status: 400 });
    if (!type || !["income", "expense"].includes(type)) return NextResponse.json({ error: "Le type est requis" }, { status: 400 });

    const [rec] = await db.insert(finance_recurring).values({
      name: name.trim(),
      amount: String(parseFloat(amount).toFixed(2)),
      type,
      category_id: category_id ?? null,
      day_of_month: day_of_month ?? 1,
      active: true,
      notes: notes ?? null,
    }).returning();
    return NextResponse.json(rec, { status: 201 });
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
    const updates: Partial<typeof finance_recurring.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.amount !== undefined) updates.amount = String(parseFloat(body.amount).toFixed(2));
    if (body.type !== undefined) updates.type = body.type;
    if (body.category_id !== undefined) updates.category_id = body.category_id;
    if (body.day_of_month !== undefined) updates.day_of_month = body.day_of_month;
    if (body.active !== undefined) updates.active = body.active;
    if (body.notes !== undefined) updates.notes = body.notes;

    const [updated] = await db.update(finance_recurring).set(updates).where(eq(finance_recurring.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Récurrent non trouvé" }, { status: 404 });
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

    await db.delete(finance_recurring).where(eq(finance_recurring.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
