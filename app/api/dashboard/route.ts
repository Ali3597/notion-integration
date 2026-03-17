import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  tasks,
  sessions,
  meditations,
  books,
  authors,
  shopping_items,
  reminders,
  habits,
  habit_logs,
  journal_entries,
  journal_logs,
} from "@/lib/schema";
import { eq, and, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";

function ldate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = ldate(today);

    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in7DaysStr = ldate(in7Days);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      urgentReminders,
      activeProjectsList,
      todayStats,
      lastSessionRow,
      lastMeditationRow,
      monthMedRow,
      readingBooks,
      shoppingRow,
      recentShoppingItems,
      habitsToday,
      habitLogsToday,
      journalReview,
    ] = await Promise.all([
      // Urgent reminders: non-done, due within 7 days (including overdue)
      db
        .select({ id: reminders.id, name: reminders.name, due_date: reminders.due_date, done: reminders.done })
        .from(reminders)
        .where(and(eq(reminders.done, false), lte(reminders.due_date, in7DaysStr)))
        .orderBy(asc(reminders.due_date)),

      // Active projects
      db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.status, "En cours")),

      // Today pomodoro stats
      db
        .select({
          session_count: sql<number>`count(*)`,
          total_minutes: sql<number>`coalesce(round(sum(extract(epoch from (end_time - start_time)) / 60)), 0)`,
        })
        .from(sessions)
        .where(gte(sessions.start_time, today)),

      // Last project worked on today
      db
        .select({ project_name: projects.name })
        .from(sessions)
        .leftJoin(projects, eq(sessions.project_id, projects.id))
        .where(gte(sessions.start_time, today))
        .orderBy(desc(sessions.start_time))
        .limit(1),

      // Last meditation
      db
        .select({ lesson: meditations.lesson, date: meditations.date, duration_min: meditations.duration_min, streak: meditations.streak })
        .from(meditations)
        .orderBy(desc(meditations.date))
        .limit(1),

      // Month meditation stats
      db
        .select({
          count: sql<number>`count(*)`,
          total_minutes: sql<number>`coalesce(sum(duration_min::numeric), 0)`,
        })
        .from(meditations)
        .where(gte(meditations.date, monthStart)),

      // Books being read (max 3)
      db
        .select({ id: books.id, title: books.title, image_url: books.image_url, author_name: authors.name })
        .from(books)
        .leftJoin(authors, eq(books.author_id, authors.id))
        .where(eq(books.status, "En cours"))
        .limit(3),

      // Shopping overview
      db
        .select({
          non_purchased_count: sql<number>`count(*) filter (where purchased = false)`,
          remaining_budget: sql<number>`coalesce(sum(estimated_price::numeric) filter (where purchased = false), 0)`,
        })
        .from(shopping_items),

      // 3 recent non-purchased items
      db
        .select({ name: shopping_items.name, estimated_price: shopping_items.estimated_price })
        .from(shopping_items)
        .where(eq(shopping_items.purchased, false))
        .orderBy(desc(shopping_items.created_at))
        .limit(3),

      // Active habits
      db
        .select({ id: habits.id, name: habits.name, icon: habits.icon, color: habits.color, frequency_type: habits.frequency_type, frequency_days: habits.frequency_days })
        .from(habits)
        .where(eq(habits.active, true))
        .orderBy(habits.created_at),

      // Today's habit logs
      db
        .select({ habit_id: habit_logs.habit_id })
        .from(habit_logs)
        .where(eq(habit_logs.completed_date, todayStr)),

      // Journal entries with review_date due within 7 days or overdue
      db
        .select({
          id: journal_entries.id,
          title: journal_entries.title,
          review_date: sql<string>`(select review_date::text from journal_logs jl where jl.entry_id = journal_entries.id and jl.review_date is not null order by jl.created_at desc limit 1)`,
        })
        .from(journal_entries)
        .where(
          sql`exists (select 1 from journal_logs jl where jl.entry_id = journal_entries.id and jl.review_date is not null and jl.review_date <= ${in7DaysStr}::date)`
        )
        .orderBy(
          sql`(select review_date from journal_logs jl where jl.entry_id = journal_entries.id and jl.review_date is not null order by jl.created_at desc limit 1) asc nulls last`
        ),
    ]);

    // Fetch tasks for active projects
    const projectIds = activeProjectsList.map((p) => p.id);
    const allProjectTasks =
      projectIds.length > 0
        ? await db
            .select({
              id: tasks.id,
              name: tasks.name,
              status: tasks.status,
              project_id: tasks.project_id,
            })
            .from(tasks)
            .where(inArray(tasks.project_id, projectIds))
        : [];

    // Attach tasks to projects
    const projectsWithTasks = activeProjectsList.map((project) => {
      const projectTasks = allProjectTasks.filter((t) => t.project_id === project.id);
      const total = projectTasks.length;
      const completed = projectTasks.filter((t) => t.status === "Terminé").length;
      const pending = projectTasks.filter((t) => t.status === "À faire" || t.status === "En cours");

      return {
        id: project.id,
        name: project.name,
        total_tasks: total,
        completed_tasks: completed,
        pending_tasks: pending.slice(0, 3).map((t) => ({
          id: t.id,
          name: t.name,
        })),
        extra_task_count: Math.max(0, pending.length - 3),
      };
    });

    // Compute habits today
    const loggedTodaySet = new Set(habitLogsToday.map((l) => l.habit_id));
    const habitsDueToday = habitsToday.filter((h) => {
      const today2 = new Date();
      const isoDay = today2.getDay() === 0 ? 7 : today2.getDay();
      switch (h.frequency_type) {
        case "daily": return true;
        case "specific_days": {
          const days: number[] = JSON.parse(h.frequency_days || "[]");
          return days.includes(isoDay);
        }
        case "weekly": return true;
        case "monthly": {
          const day = parseInt(h.frequency_days || "1", 10);
          return today2.getDate() === day;
        }
        default: return false;
      }
    });
    const habitsWidget = habitsDueToday.map((h) => ({
      ...h,
      completed_today: loggedTodaySet.has(h.id),
    }));

    return NextResponse.json({
      reminders: urgentReminders,
      projects: projectsWithTasks,
      habits: habitsWidget,
      pomodoro: {
        session_count: Number(todayStats[0]?.session_count ?? 0),
        total_minutes: Number(todayStats[0]?.total_minutes ?? 0),
        last_project: lastSessionRow[0] ?? null,
      },
      meditation: {
        streak: lastMeditationRow[0]?.streak ?? 0,
        last_session: lastMeditationRow[0] ?? null,
        month_count: Number(monthMedRow[0]?.count ?? 0),
        month_minutes: Math.round(Number(monthMedRow[0]?.total_minutes ?? 0)),
      },
      books_reading: readingBooks,
      shopping: {
        non_purchased_count: Number(shoppingRow[0]?.non_purchased_count ?? 0),
        remaining_budget: Number(shoppingRow[0]?.remaining_budget ?? 0),
        recent_items: recentShoppingItems,
      },
      journal_review: journalReview.filter((e) => e.review_date !== null),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
