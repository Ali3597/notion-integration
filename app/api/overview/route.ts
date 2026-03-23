import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks, meditations, shopping_items, reminders, books, journal_entries, birthdays, weight_entries, dnd_sessions } from "@/lib/schema";
import { sql, desc, and, eq, gte } from "drizzle-orm";

export async function GET() {
  try {
    const [
      projectStats,
      taskStats,
      lastMeditation,
      shoppingStats,
      reminderStats,
      libraryStats,
      journalReview,
      allBirthdays,
      lastWeightRows,
      weekAgoWeightRows,
      nextDndSessionRows,
    ] = await Promise.all([
      db.select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where status = 'En cours')`,
      }).from(projects),
      db.select({
        total: sql<number>`count(*)`,
        in_progress: sql<number>`count(*) filter (where status = 'En cours')`,
      }).from(tasks),
      db.select({
        lesson: meditations.lesson,
        date: meditations.date,
        streak: meditations.streak,
      }).from(meditations).orderBy(desc(meditations.date)).limit(1),
      db.select({
        total: sql<number>`count(*)`,
        remaining_budget: sql<number>`coalesce(sum(estimated_price) filter (where purchased = false), 0)`,
        to_buy: sql<number>`count(*) filter (where purchased = false)`,
      }).from(shopping_items),
      db.select({
        undone: sql<number>`count(*) filter (where done = false)`,
        overdue: sql<number>`count(*) filter (where done = false and due_date < current_date)`,
        today: sql<number>`count(*) filter (where done = false and due_date = current_date)`,
        tomorrow: sql<number>`count(*) filter (where done = false and due_date = current_date + 1)`,
      }).from(reminders),
      db.select({
        reading: sql<number>`count(*) filter (where status = 'En cours')`,
        read: sql<number>`count(*) filter (where status = 'Lu')`,
      }).from(books),

      db.select({
        id: journal_entries.id,
        title: journal_entries.title,
        review_date: sql<string>`(select review_date::text from journal_logs jl where jl.entry_id = journal_entries.id and jl.review_date is not null order by jl.created_at desc limit 1)`,
      })
        .from(journal_entries)
        .where(sql`exists (select 1 from journal_logs jl where jl.entry_id = journal_entries.id and jl.review_date is not null and jl.review_date <= (current_date + interval '7 days')::date)`),

      db.select({ birth_date: birthdays.birth_date }).from(birthdays),

      // Last weight measurement
      db.select({ weight: weight_entries.weight, measured_at: weight_entries.measured_at })
        .from(weight_entries)
        .orderBy(desc(weight_entries.measured_at))
        .limit(1),

      // Weight ~7 days ago (between 14d and 5d ago for best match)
      db.select({ weight: weight_entries.weight, measured_at: weight_entries.measured_at })
        .from(weight_entries)
        .where(sql`measured_at < now() - interval '5 days' and measured_at >= now() - interval '14 days'`)
        .orderBy(desc(weight_entries.measured_at))
        .limit(1),

      // Next D&D session
      db.select({ id: dnd_sessions.id, title: dnd_sessions.title, session_date: dnd_sessions.session_date, session_time: dnd_sessions.session_time })
        .from(dnd_sessions)
        .where(and(eq(dnd_sessions.status, "Planifiée"), gte(dnd_sessions.session_date, sql`current_date::text`)))
        .orderBy(dnd_sessions.session_date)
        .limit(1),
    ]);

    const rs = reminderStats[0];
    const ls = libraryStats[0];

    // Count birthdays in next 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birthdaysUpcoming = allBirthdays.filter(({ birth_date }) => {
      const [, monthStr, dayStr] = birth_date.split("-");
      const m = parseInt(monthStr, 10) - 1;
      const d = parseInt(dayStr, 10);
      const thisYear = new Date(today.getFullYear(), m, d);
      const next = thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, m, d);
      const diff = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length;

    const lastWeight = lastWeightRows[0] ?? null;
    const weekAgoWeight = weekAgoWeightRows[0] ?? null;
    const weightVariation = lastWeight && weekAgoWeight
      ? parseFloat(lastWeight.weight!) - parseFloat(weekAgoWeight.weight!)
      : null;

    const nextDndSession = nextDndSessionRows[0] ?? null;

    return NextResponse.json({
      projects: projectStats[0],
      tasks: taskStats[0],
      lastMeditation: lastMeditation[0] ?? null,
      shopping: shoppingStats[0],
      reminders: { undone: Number(rs.undone), overdue: Number(rs.overdue), today: Number(rs.today), tomorrow: Number(rs.tomorrow) },
      library: { reading: Number(ls.reading), read: Number(ls.read) },
      journal_review: journalReview.filter((e) => e.review_date !== null),
      birthdays_upcoming: birthdaysUpcoming,
      next_dnd_session: nextDndSession,
      health: lastWeight
        ? {
            weight: parseFloat(lastWeight.weight!),
            measured_at: lastWeight.measured_at,
            variation_7d: weightVariation !== null ? Math.round(weightVariation * 10) / 10 : null,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
