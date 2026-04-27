import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_recurring, finance_transactions } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";

// POST { month: "YYYY-MM" }
// Applies all active recurring transactions for the given month (skips already-applied ones)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { month } = body; // "YYYY-MM"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month requis (YYYY-MM)" }, { status: 400 });
    }

    const [year, m] = month.split("-").map(Number);
    const daysInMonth = new Date(year, m, 0).getDate();
    const first = `${month}-01`;
    const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;

    const [actives, existing] = await Promise.all([
      db.select().from(finance_recurring).where(eq(finance_recurring.active, true)),
      db.select({ recurring_id: finance_transactions.recurring_id })
        .from(finance_transactions)
        .where(and(gte(finance_transactions.date, first), lte(finance_transactions.date, last))),
    ]);

    const appliedIds = new Set(existing.map((e) => e.recurring_id).filter(Boolean) as string[]);
    const toApply = actives.filter((r) => !appliedIds.has(r.id));

    if (toApply.length === 0) {
      return NextResponse.json({ applied: 0, message: "Tous les récurrents sont déjà appliqués ce mois-ci." });
    }

    const inserted = await db.insert(finance_transactions).values(
      toApply.map((r) => {
        const day = Math.min(r.day_of_month ?? 1, daysInMonth);
        const date = `${month}-${String(day).padStart(2, "0")}`;
        return {
          amount: r.amount,
          description: r.name,
          category_id: r.category_id,
          type: r.type,
          date,
          notes: r.notes,
          recurring_id: r.id,
        };
      })
    ).returning();

    return NextResponse.json({ applied: inserted.length, transactions: inserted });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
