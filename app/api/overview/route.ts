import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks, sessions, meditations, shopping_items, reminders, books, journal_entries, birthdays } from "@/lib/schema";
import { eq, gte, lte, sql, desc } from "drizzle-orm";

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      projectStats,
      taskStats,
      todaySessionStats,
      lastMeditation,
      shoppingStats,
      reminderStats,
      libraryStats,
      journalReview,
      allBirthdays,
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
        session_count: sql<number>`count(*)`,
        total_minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
      }).from(sessions).where(gte(sessions.start_time, todayStart)),
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

    return NextResponse.json({
      projects: projectStats[0],
      tasks: taskStats[0],
      today: todaySessionStats[0],
      lastMeditation: lastMeditation[0] ?? null,
      shopping: shoppingStats[0],
      reminders: { undone: Number(rs.undone), overdue: Number(rs.overdue), today: Number(rs.today), tomorrow: Number(rs.tomorrow) },
      library: { reading: Number(ls.reading), read: Number(ls.read) },
      journal_review: journalReview.filter((e) => e.review_date !== null),
      birthdays_upcoming: birthdaysUpcoming,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
