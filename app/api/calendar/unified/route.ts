import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { birthdays, reminders, dnd_sessions } from "@/lib/schema";
import { eq, and, lte, gte, isNotNull } from "drizzle-orm";

export interface UnifiedEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  end_date?: string; // YYYY-MM-DD (inclusive)
  end_time?: string; // HH:MM
  source: "ical" | "birthday" | "reminder" | "dnd";
  all_day: boolean;
  metadata?: Record<string, unknown>;
}

function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTimeLocal(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getNextOccurrence(birthDate: string, fromDate: Date): Date {
  const [, monthStr, dayStr] = birthDate.split("-");
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const thisYear = new Date(fromDate.getFullYear(), month, day);
  if (thisYear >= fromDate) return thisYear;
  return new Date(fromDate.getFullYear() + 1, month, day);
}

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const in60DaysStr = formatDateLocal(in60Days);

  const events: UnifiedEvent[] = [];

  // ── iCal ──────────────────────────────────────────────────────────────────
  const icalUrl = process.env.ICAL_URL;
  if (icalUrl) {
    try {
      const res = await fetch(icalUrl, { next: { revalidate: 900 } });
      if (res.ok) {
        const icsText = await res.text();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = (await import("ical.js")) as any;
        const ICAL = mod.default ?? mod;

        const jcalData = ICAL.parse(icsText);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents("vevent");

        // Same window as existing /api/calendar for month navigation support
        const windowStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const windowEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0);

        let eventIndex = 0;

        for (const vevent of vevents) {
          try {
            const event = new ICAL.Event(vevent);
            const uid = (vevent.getFirstPropertyValue("uid") || event.summary || "") as string;

            const addOccurrence = (startDate: Date, endDate: Date, allDay: boolean, counter: number) => {
              if (endDate >= windowStart && startDate <= windowEnd) {
                const dateStr = formatDateLocal(startDate);
                // For all-day events, iCal end is exclusive → subtract 1 day for inclusive end_date
                const inclusiveEnd = allDay
                  ? formatDateLocal(new Date(endDate.getTime() - 24 * 60 * 60 * 1000))
                  : formatDateLocal(endDate);
                const effectiveEnd = inclusiveEnd < dateStr ? dateStr : inclusiveEnd;

                events.push({
                  id: `ical-${eventIndex++}-${uid.slice(0, 20)}-${counter}`,
                  title: event.summary || "(Sans titre)",
                  date: dateStr,
                  time: allDay ? undefined : formatTimeLocal(startDate),
                  end_date: effectiveEnd !== dateStr ? effectiveEnd : undefined,
                  end_time: allDay ? undefined : formatTimeLocal(endDate),
                  source: "ical",
                  all_day: allDay,
                  metadata: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                  },
                });
              }
            };

            if (event.isRecurring()) {
              const expand = new ICAL.RecurExpansion({ component: vevent, dtstart: event.startDate });
              let safety = 0;
              let next = expand.next();
              let counter = 0;
              while (next && safety < 500) {
                safety++;
                const jsDate = next.toJSDate();
                if (jsDate > windowEnd) break;
                const details = event.getOccurrenceDetails(next);
                const start = details.startDate.toJSDate();
                const end = details.endDate ? details.endDate.toJSDate() : start;
                addOccurrence(start, end, details.startDate.isDate, counter++);
                next = expand.next();
              }
            } else {
              const start = event.startDate.toJSDate();
              const end = event.endDate ? event.endDate.toJSDate() : start;
              addOccurrence(start, end, event.startDate.isDate, 0);
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch {
      // iCal fetch failed — continue without iCal events
    }
  }

  // ── Birthdays ──────────────────────────────────────────────────────────────
  try {
    const bdays = await db.select().from(birthdays);
    for (const b of bdays) {
      const next = getNextOccurrence(b.birth_date, today);
      if (next <= in60Days) {
        const [year] = b.birth_date.split("-").map(Number);
        let title = `🎂 ${b.name}`;
        if (b.year_known) {
          const age = next.getFullYear() - year;
          title += ` — ${age} ans`;
        }
        events.push({
          id: `birthday-${b.id}`,
          title,
          date: formatDateLocal(next),
          source: "birthday",
          all_day: true,
          metadata: { id: b.id, name: b.name },
        });
      }
    }
  } catch {
    // skip
  }

  // ── Reminders ──────────────────────────────────────────────────────────────
  try {
    const rems = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.done, false), isNotNull(reminders.due_date), lte(reminders.due_date, in60DaysStr)));

    for (const r of rems) {
      if (!r.due_date) continue;
      events.push({
        id: `reminder-${r.id}`,
        title: `🔔 ${r.name}`,
        date: r.due_date,
        source: "reminder",
        all_day: true,
        metadata: { id: r.id, done: r.done },
      });
    }
  } catch {
    // skip
  }

  // ── D&D Sessions ────────────────────────────────────────────────────────────
  try {
    const todayStr = formatDateLocal(today);
    const dndSessions = await db
      .select()
      .from(dnd_sessions)
      .where(and(eq(dnd_sessions.status, "Planifiée"), gte(dnd_sessions.session_date, todayStr)));

    for (const s of dndSessions) {
      events.push({
        id: `dnd-${s.id}`,
        title: `🎲 ${s.title}`,
        date: s.session_date,
        time: s.session_time ?? undefined,
        source: "dnd",
        all_day: !s.session_time,
        metadata: { id: s.id, status: s.status },
      });
    }
  } catch {
    // skip
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(events);
}
