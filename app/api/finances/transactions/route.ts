import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_transactions, finance_categories } from "@/lib/schema";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // "YYYY-MM"

    const conditions = [];
    if (month) {
      const [year, m] = month.split("-");
      const first = `${year}-${m}-01`;
      // Last day: first day of next month minus 1
      const nextMonth = new Date(parseInt(year), parseInt(m), 0);
      const last = `${year}-${m}-${String(nextMonth.getDate()).padStart(2, "0")}`;
      conditions.push(gte(finance_transactions.date, first));
      conditions.push(lte(finance_transactions.date, last));
    }

    const rows = await db
      .select({
        id: finance_transactions.id,
        amount: finance_transactions.amount,
        description: finance_transactions.description,
        type: finance_transactions.type,
        date: finance_transactions.date,
        notes: finance_transactions.notes,
        recurring_id: finance_transactions.recurring_id,
        created_at: finance_transactions.created_at,
        category_id: finance_categories.id,
        category_name: finance_categories.name,
        category_color: finance_categories.color,
        category_icon: finance_categories.icon,
      })
      .from(finance_transactions)
      .leftJoin(finance_categories, eq(finance_transactions.category_id, finance_categories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(finance_transactions.date), desc(finance_transactions.created_at));

    // Compute monthly stats
    const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + parseFloat(r.amount ?? "0"), 0);
    const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + parseFloat(r.amount ?? "0"), 0);
    const balance = income - expense;

    return NextResponse.json({
      transactions: rows,
      stats: {
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        balance: balance.toFixed(2),
        savings_rate: income > 0 ? ((balance / income) * 100).toFixed(1) : "0.0",
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
    const { amount, description, category_id, type, date, notes, recurring_id } = body;
    if (!description?.trim()) return NextResponse.json({ error: "La description est requise" }, { status: 400 });
    if (!amount || isNaN(parseFloat(amount))) return NextResponse.json({ error: "Le montant est requis" }, { status: 400 });
    if (!type || !["income", "expense"].includes(type)) return NextResponse.json({ error: "Le type est requis" }, { status: 400 });
    if (!date) return NextResponse.json({ error: "La date est requise" }, { status: 400 });

    const [tx] = await db.insert(finance_transactions).values({
      amount: String(parseFloat(amount).toFixed(2)),
      description: description.trim(),
      category_id: category_id ?? null,
      type,
      date,
      notes: notes ?? null,
      recurring_id: recurring_id ?? null,
    }).returning();
    return NextResponse.json(tx, { status: 201 });
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
    const updates: Partial<typeof finance_transactions.$inferInsert> = {};
    if (body.amount !== undefined) updates.amount = String(parseFloat(body.amount).toFixed(2));
    if (body.description !== undefined) updates.description = body.description;
    if (body.category_id !== undefined) updates.category_id = body.category_id;
    if (body.type !== undefined) updates.type = body.type;
    if (body.date !== undefined) updates.date = body.date;
    if (body.notes !== undefined) updates.notes = body.notes;

    const [updated] = await db.update(finance_transactions).set(updates).where(eq(finance_transactions.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });
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

    await db.delete(finance_transactions).where(eq(finance_transactions.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
