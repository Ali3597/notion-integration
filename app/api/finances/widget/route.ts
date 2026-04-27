import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Reuse the same balance formula from accounts/route.ts
const BALANCE_SQL = `
  a.initial_balance::numeric
  + COALESCE((
      SELECT SUM(CASE
        WHEN type = 'income'        THEN  amount::numeric
        WHEN type = 'expense'       THEN -amount::numeric
        WHEN type = 'transfer'      THEN -amount::numeric
        WHEN type = 'loan_payment'  THEN -amount::numeric
        WHEN type = 'adjustment'    THEN  amount::numeric
        ELSE 0
      END)
      FROM finance_transactions WHERE account_id = a.id
    ), 0)
  + COALESCE((
      SELECT SUM(amount::numeric)
      FROM finance_transactions WHERE to_account_id = a.id AND type IN ('transfer','loan_payment')
    ), 0)
`;

export async function GET() {
  try {
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const firstOfMonth = `${ym}-01`;
    const lastOfMonth = `${ym}-${String(daysInMonth).padStart(2, "0")}`;

    // Build last 5 months list (for sparkline)
    const months: { ym: string; label: string; lastDay: string }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const my = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const lastD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const lastDay = `${my}-${String(lastD.getDate()).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short" });
      months.push({ ym: my, label, lastDay });
    }

    const [accountRows, txRows, monthStatRows] = await Promise.all([
      // Current balances
      db.execute(`
        SELECT a.id, a.name, a.type, a.color, a.initial_balance::numeric,
          (${BALANCE_SQL}) AS current_balance
        FROM finance_accounts a
        ORDER BY a.name
      `),

      // All tx deltas for sparkline (grouped by month + account)
      db.execute(`
        SELECT
          to_char(date::date,'YYYY-MM') as month,
          account_id,
          to_account_id,
          type,
          SUM(amount::numeric) as total
        FROM finance_transactions
        GROUP BY 1,2,3,4
        ORDER BY 1
      `),

      // Current month income/expense/loan_payment
      db.execute(`
        SELECT
          CASE WHEN type='loan_payment' THEN 'expense' ELSE type END as type,
          SUM(amount::numeric) as total
        FROM finance_transactions
        WHERE type IN ('income','expense','loan_payment')
          AND date >= '${firstOfMonth}'::date
          AND date <= '${lastOfMonth}'::date
        GROUP BY 1
      `),
    ]);

    type AccountRow = { id: string; name: string; type: string; color: string; initial_balance: string; current_balance: string };
    type TxRow = { month: string; account_id: string | null; to_account_id: string | null; type: string; total: string };
    type StatRow = { type: string; total: string };

    const accounts = accountRows.rows as AccountRow[];
    const txByMonth = txRows.rows as TxRow[];

    // Current patrimony
    const totalAssets = accounts.filter((a) => a.type !== "loan").reduce((s, a) => s + parseFloat(a.current_balance), 0);
    const totalDebts = accounts.filter((a) => a.type === "loan").reduce((s, a) => s + parseFloat(a.current_balance), 0);
    const totalPatrimony = totalAssets + totalDebts;

    // Current month stats
    let monthIncome = 0, monthExpense = 0;
    for (const r of monthStatRows.rows as StatRow[]) {
      if (r.type === "income") monthIncome = parseFloat(r.total);
      if (r.type === "expense") monthExpense = parseFloat(r.total);
    }
    const monthBalance = monthIncome - monthExpense;
    const savingsRate = monthIncome > 0 ? Math.round((monthBalance / monthIncome) * 100) : 0;

    // Sparkline: compute patrimony at end of each month
    // Roll up deltas per account per month
    const deltas: Record<string, Record<string, number>> = {}; // accountId → month → delta
    for (const row of txByMonth) {
      const amt = parseFloat(row.total);
      if (row.account_id) {
        if (!deltas[row.account_id]) deltas[row.account_id] = {};
        let d = 0;
        if (row.type === "income") d = amt;
        else if (row.type === "expense") d = -amt;
        else if (row.type === "transfer" || row.type === "loan_payment") d = -amt;
        else if (row.type === "adjustment") d = amt;
        deltas[row.account_id][row.month] = (deltas[row.account_id][row.month] ?? 0) + d;
      }
      if (row.to_account_id && (row.type === "transfer" || row.type === "loan_payment")) {
        if (!deltas[row.to_account_id]) deltas[row.to_account_id] = {};
        deltas[row.to_account_id][row.month] = (deltas[row.to_account_id][row.month] ?? 0) + amt;
      }
    }

    // For each month end, compute each account's cumulative balance
    const allMonths = [...new Set(txByMonth.map((r) => r.month))].sort();
    const monthlyPatrimony = months.map(({ ym: targetYm, label }) => {
      // Sum: initial + all deltas up to and including targetYm
      const total = accounts.reduce((sum, a) => {
        let bal = parseFloat(a.initial_balance);
        const acctDeltas = deltas[a.id] ?? {};
        for (const m of allMonths) {
          if (m <= targetYm) bal += acctDeltas[m] ?? 0;
        }
        return sum + bal;
      }, 0);
      return { label, ym: targetYm, total: Math.round(total * 100) / 100 };
    });

    // Trend = current vs previous month
    const prevMonthTotal = monthlyPatrimony.length >= 2 ? monthlyPatrimony[monthlyPatrimony.length - 2].total : 0;
    const patrimonyChange = totalPatrimony - prevMonthTotal;

    // Top accounts by balance (for display)
    const topAccounts = accounts
      .filter((a) => a.type !== "loan")
      .sort((a, b) => parseFloat(b.current_balance) - parseFloat(a.current_balance))
      .slice(0, 4)
      .map((a) => ({ name: a.name, type: a.type, color: a.color, balance: parseFloat(a.current_balance) }));

    return NextResponse.json({
      total_patrimony: Math.round(totalPatrimony * 100) / 100,
      assets: Math.round(totalAssets * 100) / 100,
      debts: Math.round(totalDebts * 100) / 100,
      patrimony_change: Math.round(patrimonyChange * 100) / 100,
      current_month: {
        income: Math.round(monthIncome * 100) / 100,
        expense: Math.round(monthExpense * 100) / 100,
        balance: Math.round(monthBalance * 100) / 100,
        savings_rate: savingsRate,
      },
      monthly_patrimony: monthlyPatrimony,
      top_accounts: topAccounts,
      has_loans: totalDebts < 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
