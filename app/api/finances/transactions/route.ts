import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_transactions, finance_categories, finance_accounts } from "@/lib/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const toAccount = alias(finance_accounts, "to_acc");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    const conditions = [];
    if (month) {
      const [year, m] = month.split("-");
      const first = `${year}-${m}-01`;
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
        account_id: finance_transactions.account_id,
        to_account_id: finance_transactions.to_account_id,
        created_at: finance_transactions.created_at,
        category_id: finance_categories.id,
        category_name: finance_categories.name,
        category_color: finance_categories.color,
        category_icon: finance_categories.icon,
        account_name: finance_accounts.name,
        account_color: finance_accounts.color,
        to_account_name: toAccount.name,
        to_account_color: toAccount.color,
      })
      .from(finance_transactions)
      .leftJoin(finance_categories, eq(finance_transactions.category_id, finance_categories.id))
      .leftJoin(finance_accounts, eq(finance_transactions.account_id, finance_accounts.id))
      .leftJoin(toAccount, eq(finance_transactions.to_account_id, toAccount.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(finance_transactions.date), desc(finance_transactions.created_at));

    // income + expense + loan_payment count toward monthly budget stats
    const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + parseFloat(r.amount ?? "0"), 0);
    const expense = rows.filter((r) => r.type === "expense" || r.type === "loan_payment").reduce((s, r) => s + parseFloat(r.amount ?? "0"), 0);
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
    const { amount, description, category_id, type, date, notes, account_id, to_account_id, recurring_id } = body;

    if (!type || !["income", "expense", "transfer", "adjustment", "loan_payment"].includes(type))
      return NextResponse.json({ error: "Le type est requis" }, { status: 400 });
    if (!date) return NextResponse.json({ error: "La date est requise" }, { status: 400 });

    if (type === "transfer" || type === "loan_payment") {
      if (!account_id) return NextResponse.json({ error: "Compte source requis" }, { status: 400 });
      if (!to_account_id) return NextResponse.json({ error: "Compte destination requis" }, { status: 400 });
      if (!amount || isNaN(parseFloat(amount))) return NextResponse.json({ error: "Le montant est requis" }, { status: 400 });
    } else if (type === "adjustment") {
      if (!account_id) return NextResponse.json({ error: "Compte requis" }, { status: 400 });
      if (amount === undefined || amount === "" || isNaN(parseFloat(amount)))
        return NextResponse.json({ error: "Le montant d'ajustement est requis" }, { status: 400 });
    } else {
      if (!description?.trim()) return NextResponse.json({ error: "La description est requise" }, { status: 400 });
      if (!amount || isNaN(parseFloat(amount))) return NextResponse.json({ error: "Le montant est requis" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);

    const [tx] = await db.insert(finance_transactions).values({
      amount: String(parsedAmount.toFixed(2)), // can be negative for adjustments
      description: description?.trim() || (type === "transfer" ? "Virement" : "Ajustement de solde"),
      category_id: category_id ?? null,
      type,
      date,
      notes: notes ?? null,
      account_id: account_id ?? null,
      to_account_id: to_account_id ?? null,
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
    if (body.account_id !== undefined) updates.account_id = body.account_id || null;
    if (body.to_account_id !== undefined) updates.to_account_id = body.to_account_id || null;

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
