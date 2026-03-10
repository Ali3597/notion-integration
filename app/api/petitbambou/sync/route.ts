import { NextResponse } from "next/server";
import {
  getSessionsLastWeek,
  getSessionsLast3Months,
  getAllSessions,
  getTodaySessions,
  computeStreaks,
} from "@/lib/petitbambou";
import { db } from "@/lib/db";
import { meditations } from "@/lib/schema";
import { inArray, sql } from "drizzle-orm";
import type { PBSession } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode: "recent" | "all" | "today" | "week" = body.mode ?? "recent";

    let pbSessions: PBSession[];
    if (mode === "all") {
      pbSessions = await getAllSessions();
    } else if (mode === "today") {
      pbSessions = await getTodaySessions();
    } else if (mode === "week") {
      pbSessions = await getSessionsLastWeek();
    } else {
      pbSessions = await getSessionsLast3Months();
    }

    // Get existing UUIDs from DB to avoid duplicates
    const uuids = pbSessions.map((s) => s.uuid);
    const existingRows = uuids.length
      ? await db
          .select({ pb_uuid: meditations.pb_uuid, date: meditations.date })
          .from(meditations)
          .where(inArray(meditations.pb_uuid, uuids))
      : [];
    const existingUUIDs = new Set(existingRows.map((r) => r.pb_uuid!));

    // Also fetch all existing for streak computation
    const allExisting = await db
      .select({ pb_uuid: meditations.pb_uuid, date: meditations.date })
      .from(meditations);

    const toCreate = pbSessions.filter((s) => !existingUUIDs.has(s.uuid));

    // Merge for streak computation
    const allForStreak = [
      ...allExisting
        .filter((r) => r.pb_uuid && r.date)
        .map((r) => ({ uuid: r.pb_uuid!, activity_date: r.date!.toISOString().substring(0, 10) + " 00:00:00" })),
      ...toCreate.map((s) => ({ uuid: s.uuid, activity_date: s.activity_date })),
    ];
    const streakMap = computeStreaks(allForStreak);

    let pushed = 0;
    let errors = 0;

    for (const s of toCreate) {
      try {
        const durationMin = Math.round(s.duration / 60);
        const date = new Date(parseInt(s.activity_time, 10) * 1000);
        await db.insert(meditations).values({
          lesson: s.lesson_name,
          date,
          duration_min: String(durationMin),
          pb_uuid: s.uuid,
          streak: streakMap.get(s.uuid) ?? 1,
        });
        pushed++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({ pushed, errors });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur sync Petit Bambou" }, { status: 500 });
  }
}
