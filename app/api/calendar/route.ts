import { NextResponse } from "next/server";

export const revalidate = 900;

interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

export async function GET() {
  try {
    const icalUrl = process.env.ICAL_URL;
    if (!icalUrl) {
      return NextResponse.json({ error: "ICAL_URL not configured" }, { status: 500 });
    }

    const res = await fetch(icalUrl, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const icsText = await res.text();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import("ical.js")) as any;
    const ICAL = mod.default ?? mod;

    const jcalData = ICAL.parse(icsText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    // Window: start of previous month → end of 2 months ahead (covers month navigation)
    const today = new Date();
    const windowStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const windowEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0);
    const now = windowStart;

    const events: CalendarEvent[] = [];

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent);

        if (event.isRecurring()) {
          const expand = new ICAL.RecurExpansion({
            component: vevent,
            dtstart: event.startDate,
          });

          let safety = 0;
          let next = expand.next();
          while (next && safety < 500) {
            safety++;
            const jsDate = next.toJSDate();
            if (jsDate > windowEnd) break;

            const details = event.getOccurrenceDetails(next);
            const start = details.startDate.toJSDate();
            const end = details.endDate ? details.endDate.toJSDate() : start;

            if (end >= windowStart) {
              events.push({
                title: event.summary || "(Sans titre)",
                start: start.toISOString(),
                end: end.toISOString(),
                allDay: details.startDate.isDate,
              });
            }
            next = expand.next();
          }
        } else {
          const start = event.startDate.toJSDate();
          const end = event.endDate ? event.endDate.toJSDate() : start;

          if (end >= windowStart && start <= windowEnd) {
            events.push({
              title: event.summary || "(Sans titre)",
              start: start.toISOString(),
              end: end.toISOString(),
              allDay: event.startDate.isDate,
            });
          }
        }
      } catch {
        // Skip malformed events
      }
    }

    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return NextResponse.json(events);
  } catch (error) {
    console.error("Calendar error:", error);
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}
