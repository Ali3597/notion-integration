import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_accounts } from "@/lib/schema";
import { eq } from "drizzle-orm";

// Balance = initial_balance
//   + income transactions on account
//   - expense transactions on account
//   - outgoing transfers / loan_payments from account
//   + incoming transfers / loan_payments to account (reduces loan balance toward 0)
//   + adjustments on account (signed delta, can be negative)
const BALANCE_SQL = (alias = "a") => `
  ${alias}.initial_balance::numeric
  + COALESCE((
      SELECT SUM(CASE
        WHEN type = 'income'        THEN  amount::numeric
        WHEN type = 'expense'       THEN -amount::numeric
        WHEN type = 'transfer'      THEN -amount::numeric
        WHEN type = 'loan_payment'  THEN -amount::numeric
        WHEN type = 'adjustment'    THEN  amount::numeric
        ELSE 0
      END)
      FROM finance_transactions WHERE account_id = ${alias}.id
    ), 0)
  + COALESCE((
      SELECT SUM(amount::numeric)
      FROM finance_transactions WHERE to_account_id = ${alias}.id AND type IN ('transfer','loan_payment')
    ), 0)
`;

export async function GET() {
  try {
    const rows = await db.execute(`
      SELECT
        a.id, a.name, a.type, a.institution, a.color, a.initial_balance, a.created_at,
        (${BALANCE_SQL()}) AS current_balance
      FROM finance_accounts a
      ORDER BY a.name
    `);
    return NextResponse.json(rows.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, institution, color, initial_balance } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const [account] = await db.insert(finance_accounts).values({
      name: name.trim(),
      type: type ?? "savings",
      institution: institution ?? null,
      color: color ?? "#3b7ef8",
      initial_balance: initial_balance !== undefined && initial_balance !== ""
        ? String(parseFloat(initial_balance).toFixed(2)) : "0",
    }).returning();
    return NextResponse.json(account, { status: 201 });
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
    const updates: Partial<typeof finance_accounts.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.type !== undefined) updates.type = body.type;
    if (body.institution !== undefined) updates.institution = body.institution;
    if (body.color !== undefined) updates.color = body.color;
    if (body.initial_balance !== undefined)
      updates.initial_balance = body.initial_balance !== ""
        ? String(parseFloat(body.initial_balance).toFixed(2)) : "0";

    const [updated] = await db.update(finance_accounts).set(updates).where(eq(finance_accounts.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Compte non trouvé" }, { status: 404 });
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

    await db.delete(finance_accounts).where(eq(finance_accounts.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
