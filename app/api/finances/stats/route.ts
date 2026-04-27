import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_accounts } from "@/lib/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") ?? "6", 10);

    const today = new Date();
    const monthsList: { label: string; yearMonth: string }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      monthsList.push({ label, yearMonth: ym });
    }
    const firstDate = monthsList[0].yearMonth + "-01";

    const [
      monthlyRows,
      allCatRows,
      dailyRows,
      catByMonthRows,
      dowRows,
      allAccounts,
      accountTxRows,
      savingsInflowRows,
    ] = await Promise.all([
      // income + expense + loan_payment count in budget stats (loan_payment mapped to expense)
      db.execute(`
        SELECT to_char(date::date,'YYYY-MM') as month,
          CASE WHEN type='loan_payment' THEN 'expense' ELSE type END as type,
          sum(amount) as total
        FROM finance_transactions
        WHERE type IN ('income','expense','loan_payment') AND date >= '${firstDate}'::date
        GROUP BY 1,2 ORDER BY 1
      `),
      db.execute(`
        SELECT fc.id, fc.name, fc.color, fc.icon, sum(ft.amount) as total
        FROM finance_transactions ft
        LEFT JOIN finance_categories fc ON ft.category_id = fc.id
        WHERE ft.type IN ('expense','loan_payment')
        GROUP BY fc.id, fc.name, fc.color, fc.icon
        ORDER BY total DESC
      `),
      db.execute(`
        SELECT
          date::text AS date,
          COALESCE(SUM(amount) FILTER (WHERE type IN ('expense','loan_payment')), 0) AS expense,
          COALESCE(SUM(amount) FILTER (WHERE type='income'), 0) AS income
        FROM finance_transactions
        WHERE type IN ('income','expense','loan_payment') AND date >= '${firstDate}'::date
        GROUP BY date ORDER BY date
      `),
      db.execute(`
        SELECT
          to_char(ft.date::date,'YYYY-MM') as month,
          COALESCE(fc.id::text,'none') as cat_id,
          COALESCE(fc.name,'Sans catégorie') as cat_name,
          COALESCE(fc.color,'#9ca3af') as cat_color,
          COALESCE(fc.icon,'💰') as cat_icon,
          SUM(ft.amount) as total
        FROM finance_transactions ft
        LEFT JOIN finance_categories fc ON ft.category_id = fc.id
        WHERE ft.type IN ('expense','loan_payment') AND ft.date >= '${firstDate}'::date
        GROUP BY 1,2,3,4,5 ORDER BY 1, total DESC
      `),
      db.execute(`
        SELECT
          extract(isodow FROM date::date)::int AS dow,
          SUM(amount) AS total, COUNT(*) AS tx_count
        FROM finance_transactions
        WHERE type IN ('expense','loan_payment') AND date >= '${firstDate}'::date
        GROUP BY 1 ORDER BY 1
      `),
      db.select().from(finance_accounts),
      // All transactions affecting any account (for balance timelines)
      db.execute(`
        SELECT date::text AS date, account_id, to_account_id, type,
          SUM(amount::numeric) AS total
        FROM finance_transactions
        WHERE account_id IS NOT NULL OR to_account_id IS NOT NULL
        GROUP BY date, account_id, to_account_id, type
        ORDER BY date
      `),
      // Monthly inflows into savings/investment accounts (via transfers)
      db.execute(`
        SELECT to_char(ft.date::date,'YYYY-MM') as month, SUM(ft.amount::numeric) as total
        FROM finance_transactions ft
        JOIN finance_accounts fa ON ft.to_account_id = fa.id
        WHERE ft.type = 'transfer'
          AND fa.type IN ('savings','investment')
          AND ft.date >= '${firstDate}'::date
        GROUP BY 1 ORDER BY 1
      `),
    ]);

    // ── Monthly summary (income/expense only) ─────────────────────────────────
    const monthlyMap: Record<string, { income: number; expense: number }> = {};
    for (const row of monthlyRows.rows as { month: string; type: string; total: string }[]) {
      if (!monthlyMap[row.month]) monthlyMap[row.month] = { income: 0, expense: 0 };
      if (row.type === "income") monthlyMap[row.month].income = parseFloat(row.total);
      if (row.type === "expense") monthlyMap[row.month].expense = parseFloat(row.total);
    }
    const monthly = monthsList.map(({ label, yearMonth }) => {
      const d = monthlyMap[yearMonth] ?? { income: 0, expense: 0 };
      const balance = d.income - d.expense;
      return { label, yearMonth, income: d.income, expense: d.expense, balance, savings_rate: d.income > 0 ? Math.round((balance / d.income) * 100) : 0 };
    });

    // ── All-time category expenses ─────────────────────────────────────────────
    const allCategoryExpenses = (allCatRows.rows as { id: string; name: string; color: string; icon: string; total: string }[]).map((r) => ({
      id: r.id ?? "uncategorized", name: r.name ?? "Sans catégorie",
      color: r.color ?? "#888", icon: r.icon ?? "💰", total: parseFloat(r.total),
    }));

    // ── Daily data ────────────────────────────────────────────────────────────
    const dailyData = (dailyRows.rows as { date: string; expense: string; income: string }[]).map((r) => ({
      date: r.date, expense: parseFloat(r.expense), income: parseFloat(r.income),
    }));

    // ── Category by month ─────────────────────────────────────────────────────
    const categoryByMonth = (catByMonthRows.rows as { month: string; cat_id: string; cat_name: string; cat_color: string; cat_icon: string; total: string }[]).map((r) => ({
      month: r.month, cat_id: r.cat_id, cat_name: r.cat_name,
      cat_color: r.cat_color, cat_icon: r.cat_icon, total: parseFloat(r.total),
    }));

    // ── Day-of-week spending ───────────────────────────────────────────────────
    const DOW_FR = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const byDayOfWeek = (dowRows.rows as { dow: number; total: string; tx_count: string }[]).map((r) => ({
      day: DOW_FR[r.dow] ?? String(r.dow), total: parseFloat(r.total), count: parseInt(r.tx_count),
    }));

    // ── Account balance timelines ─────────────────────────────────────────────
    type ATRow = { date: string; account_id: string | null; to_account_id: string | null; type: string; total: string };
    const allDates = [...new Set((accountTxRows.rows as ATRow[]).map((r) => r.date))].sort();

    const deltas: Record<string, Record<string, number>> = {};
    for (const row of accountTxRows.rows as ATRow[]) {
      const amt = parseFloat(row.total);
      // Impact on source account
      if (row.account_id) {
        if (!deltas[row.account_id]) deltas[row.account_id] = {};
        let delta = 0;
        if (row.type === "income") delta = amt;
        else if (row.type === "expense") delta = -amt;
        else if (row.type === "transfer") delta = -amt;
        else if (row.type === "loan_payment") delta = -amt;
        else if (row.type === "adjustment") delta = amt; // signed
        deltas[row.account_id][row.date] = (deltas[row.account_id][row.date] ?? 0) + delta;
      }
      // Impact on destination account (transfers + loan_payments)
      if (row.to_account_id && (row.type === "transfer" || row.type === "loan_payment")) {
        if (!deltas[row.to_account_id]) deltas[row.to_account_id] = {};
        deltas[row.to_account_id][row.date] = (deltas[row.to_account_id][row.date] ?? 0) + amt;
      }
    }

    const accountsSummary = allAccounts.map((a) => {
      const initial = parseFloat(String(a.initial_balance ?? "0"));
      const accountDeltas = deltas[a.id] ?? {};
      let running = initial;
      const timeline: { date: string; balance: number }[] = [];
      for (const date of allDates) {
        running += accountDeltas[date] ?? 0;
        timeline.push({ date, balance: Math.round(running * 100) / 100 });
      }
      const currentBalance = timeline.length > 0 ? timeline[timeline.length - 1].balance : initial;
      return { id: a.id, name: a.name, type: a.type, color: a.color, initial_balance: initial, current_balance: currentBalance, timeline };
    });

    const totalPatrimony = accountsSummary.reduce((s, a) => s + a.current_balance, 0);
    const patrimonyTimeline: { date: string; total: number }[] = allDates.map((date) => {
      const total = accountsSummary.reduce((s, a) => {
        const entry = [...a.timeline].reverse().find((e) => e.date <= date);
        return s + (entry?.balance ?? a.initial_balance);
      }, 0);
      return { date, total: Math.round(total * 100) / 100 };
    });

    // ── Savings inflows per month ─────────────────────────────────────────────
    const savingsInflowMap: Record<string, number> = {};
    for (const row of savingsInflowRows.rows as { month: string; total: string }[]) {
      savingsInflowMap[row.month] = parseFloat(row.total);
    }
    const savingsInflows = monthsList.map(({ label, yearMonth }) => ({
      label, yearMonth, total: savingsInflowMap[yearMonth] ?? 0,
    }));

    // ── Trends ────────────────────────────────────────────────────────────────
    const lastTwo = monthly.slice(-2);
    const trends = {
      expense_vs_prev: lastTwo.length >= 2 ? lastTwo[1].expense - lastTwo[0].expense : 0,
      income_vs_prev: lastTwo.length >= 2 ? lastTwo[1].income - lastTwo[0].income : 0,
      savings_vs_prev: lastTwo.length >= 2 ? lastTwo[1].balance - lastTwo[0].balance : 0,
      patrimony_trend: patrimonyTimeline.length >= 2
        ? patrimonyTimeline[patrimonyTimeline.length - 1].total - patrimonyTimeline[patrimonyTimeline.length - 2].total : 0,
    };

    return NextResponse.json({
      monthly, allCategoryExpenses, dailyData, categoryByMonth, byDayOfWeek,
      accounts: accountsSummary, totalPatrimony, patrimonyTimeline, savingsInflows, trends,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
