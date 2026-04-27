import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_categories, finance_transactions, finance_recurring } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: finance_categories.id,
        name: finance_categories.name,
        color: finance_categories.color,
        icon: finance_categories.icon,
        type: finance_categories.type,
        budget: finance_categories.budget,
        created_at: finance_categories.created_at,
        transaction_count: sql<number>`(select count(*) from finance_transactions ft where ft.category_id = finance_categories.id)`,
      })
      .from(finance_categories)
      .orderBy(finance_categories.name);
    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color, icon, type, budget } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const [cat] = await db.insert(finance_categories).values({
      name: name.trim(),
      color: color ?? "#3b7ef8",
      icon: icon ?? "💰",
      type: type ?? "both",
      budget: budget !== undefined && budget !== "" ? String(parseFloat(budget).toFixed(2)) : null,
    }).returning();
    return NextResponse.json(cat, { status: 201 });
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
    const updates: Partial<typeof finance_categories.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.color !== undefined) updates.color = body.color;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.type !== undefined) updates.type = body.type;
    if (body.budget !== undefined) updates.budget = body.budget !== "" && body.budget !== null ? String(parseFloat(body.budget).toFixed(2)) : null;

    const [updated] = await db.update(finance_categories).set(updates).where(eq(finance_categories.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Catégorie non trouvée" }, { status: 404 });
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

    await db.delete(finance_categories).where(eq(finance_categories.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
