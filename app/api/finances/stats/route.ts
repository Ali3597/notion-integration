import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_accounts, finance_account_snapshots } from "@/lib/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") ?? "6", 10);

    // Build last N months list
    const today = new Date();
    const monthsList: { label: string; yearMonth: string }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      monthsList.push({ label, yearMonth: ym });
    }

    const firstDate = monthsList[0].yearMonth + "-01";

    // All queries in parallel
    const [
      monthlyRows,
      allCatRows,
      dailyRows,
      catByMonthRows,
      dowRows,
      allAccounts,
      allSnaps,
    ] = await Promise.all([
      // Monthly income/expense totals
      db.execute(`
        select to_char(date::date,'YYYY-MM') as month, type, sum(amount) as total
        from finance_transactions
        where date >= '${firstDate}'::date
        group by 1,2 order by 1
      `),
      // All-time expense by category (for donut)
      db.execute(`
        select fc.id, fc.name, fc.color, fc.icon, sum(ft.amount) as total
        from finance_transactions ft
        left join finance_categories fc on ft.category_id = fc.id
        where ft.type = 'expense'
        group by fc.id, fc.name, fc.color, fc.icon
        order by total desc
      `),
      // Daily income + expense (for heatmap and cumulative balance)
      db.execute(`
        select
          date::text as date,
          coalesce(sum(amount) filter (where type='expense'),0) as expense,
          coalesce(sum(amount) filter (where type='income'),0) as income
        from finance_transactions
        where date >= '${firstDate}'::date
        group by date
        order by date
      `),
      // Expense by category by month (for stacked chart)
      db.execute(`
        select
          to_char(ft.date::date,'YYYY-MM') as month,
          coalesce(fc.id::text,'none') as cat_id,
          coalesce(fc.name,'Sans catégorie') as cat_name,
          coalesce(fc.color,'#9ca3af') as cat_color,
          coalesce(fc.icon,'💰') as cat_icon,
          sum(ft.amount) as total
        from finance_transactions ft
        left join finance_categories fc on ft.category_id = fc.id
        where ft.type = 'expense' and ft.date >= '${firstDate}'::date
        group by 1,2,3,4,5
        order by 1, total desc
      `),
      // Spending by ISO day of week (1=Mon … 7=Sun)
      db.execute(`
        select
          extract(isodow from date::date)::int as dow,
          sum(amount) as total,
          count(*) as tx_count
        from finance_transactions
        where type='expense' and date >= '${firstDate}'::date
        group by 1 order by 1
      `),
      db.select().from(finance_accounts),
      db.select().from(finance_account_snapshots).orderBy(finance_account_snapshots.date),
    ]);

    // ── Monthly summary ────────────────────────────────────────────────────────
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
      id: r.id ?? "uncategorized",
      name: r.name ?? "Sans catégorie",
      color: r.color ?? "#888",
      icon: r.icon ?? "💰",
      total: parseFloat(r.total),
    }));

    // ── Daily data ────────────────────────────────────────────────────────────
    const dailyData = (dailyRows.rows as { date: string; expense: string; income: string }[]).map((r) => ({
      date: r.date,
      expense: parseFloat(r.expense),
      income: parseFloat(r.income),
    }));

    // ── Category by month ─────────────────────────────────────────────────────
    const categoryByMonth = (catByMonthRows.rows as { month: string; cat_id: string; cat_name: string; cat_color: string; cat_icon: string; total: string }[]).map((r) => ({
      month: r.month,
      cat_id: r.cat_id,
      cat_name: r.cat_name,
      cat_color: r.cat_color,
      cat_icon: r.cat_icon,
      total: parseFloat(r.total),
    }));

    // ── Day-of-week spending ───────────────────────────────────────────────────
    const DOW_FR = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const byDayOfWeek = (dowRows.rows as { dow: number; total: string; tx_count: string }[]).map((r) => ({
      day: DOW_FR[r.dow] ?? String(r.dow),
      total: parseFloat(r.total),
      count: parseInt(r.tx_count),
    }));

    // ── Patrimony ─────────────────────────────────────────────────────────────
    const snapsByAccount: Record<string, { date: string; balance: number }[]> = {};
    for (const snap of allSnaps) {
      if (!snapsByAccount[snap.account_id]) snapsByAccount[snap.account_id] = [];
      snapsByAccount[snap.account_id].push({ date: snap.date, balance: parseFloat(snap.balance) });
    }
    const allDates = [...new Set(allSnaps.map((s) => s.date))].sort();
    const accountsSummary = allAccounts.map((a) => {
      const snaps = snapsByAccount[a.id] ?? [];
      const latest = snaps[snaps.length - 1];
      return { id: a.id, name: a.name, type: a.type, color: a.color, latest_balance: latest ? latest.balance : 0, snapshots: snaps };
    });
    const totalPatrimony = accountsSummary.reduce((s, a) => s + a.latest_balance, 0);
    const patrimonyTimeline: { date: string; total: number }[] = allDates.map((date) => {
      let total = 0;
      for (const account of allAccounts) {
        const snaps = (snapsByAccount[account.id] ?? []).filter((s) => s.date <= date);
        if (snaps.length > 0) total += snaps[snaps.length - 1].balance;
      }
      return { date, total };
    });

    // ── Trends ────────────────────────────────────────────────────────────────
    const lastTwo = monthly.slice(-2);
    const trends = {
      expense_vs_prev: lastTwo.length >= 2 ? lastTwo[1].expense - lastTwo[0].expense : 0,
      income_vs_prev: lastTwo.length >= 2 ? lastTwo[1].income - lastTwo[0].income : 0,
      savings_vs_prev: lastTwo.length >= 2 ? lastTwo[1].balance - lastTwo[0].balance : 0,
      patrimony_trend: patrimonyTimeline.length >= 2 ? patrimonyTimeline[patrimonyTimeline.length - 1].total - patrimonyTimeline[patrimonyTimeline.length - 2].total : 0,
    };

    return NextResponse.json({
      monthly,
      allCategoryExpenses,
      dailyData,
      categoryByMonth,
      byDayOfWeek,
      accounts: accountsSummary,
      totalPatrimony,
      patrimonyTimeline,
      trends,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
