import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shopping_items } from "@/lib/schema";
import { eq, sql, and, isNull } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category");
    const purchasedParam = searchParams.get("purchased");

    // Build filter conditions
    const conditions = [];
    if (categoryParam) {
      conditions.push(eq(shopping_items.category, categoryParam));
    }
    if (purchasedParam === "true") {
      conditions.push(eq(shopping_items.purchased, true));
    } else if (purchasedParam === "false") {
      conditions.push(eq(shopping_items.purchased, false));
    }

    const [items, statsResult] = await Promise.all([
      conditions.length > 0
        ? db.select().from(shopping_items).where(and(...conditions)).orderBy(sql`created_at desc`)
        : db.select().from(shopping_items).orderBy(sql`created_at desc`),
      db.select({
        total: sql<number>`count(*)`,
        budget_total: sql<string>`coalesce(sum(estimated_price), 0)::numeric(10,2)`,
        spent: sql<string>`coalesce(sum(estimated_price) filter (where purchased = true), 0)::numeric(10,2)`,
        remaining: sql<string>`coalesce(sum(estimated_price) filter (where purchased = false), 0)::numeric(10,2)`,
        total_non_purchased: sql<number>`count(*) filter (where purchased = false)`,
      }).from(shopping_items),
    ]);

    const s = statsResult[0];
    return NextResponse.json({
      items,
      stats: {
        total: Number(s.total),
        budget_total: Number(s.budget_total).toFixed(2),
        spent: Number(s.spent).toFixed(2),
        remaining: Number(s.remaining).toFixed(2),
        total_non_purchased: Number(s.total_non_purchased),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, estimated_price, store_link, notes } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }
    const [item] = await db.insert(shopping_items).values({
      name: name.trim(),
      category: category ?? null,
      estimated_price: estimated_price != null ? String(estimated_price) : null,
      store_link: store_link ?? null,
      notes: notes ?? null,
    }).returning();
    return NextResponse.json(item, { status: 201 });
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
    const updates: Partial<typeof shopping_items.$inferInsert> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.estimated_price !== undefined)
      updates.estimated_price = body.estimated_price != null ? String(body.estimated_price) : null;
    if (body.purchased !== undefined) updates.purchased = body.purchased;
    if (body.store_link !== undefined) updates.store_link = body.store_link;
    if (body.notes !== undefined) updates.notes = body.notes;

    const [updated] = await db.update(shopping_items).set(updates).where(eq(shopping_items.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Item non trouvé" }, { status: 404 });
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

    await db.delete(shopping_items).where(eq(shopping_items.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
