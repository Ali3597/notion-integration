import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meditations } from "@/lib/schema";
import { eq, isNotNull } from "drizzle-orm";
import { computeStreaks } from "@/lib/petitbambou";

export async function POST() {
  try {
    const rows = await db
      .select({ id: meditations.id, pb_uuid: meditations.pb_uuid, date: meditations.date })
      .from(meditations)
      .where(isNotNull(meditations.pb_uuid));

    const sessions = rows
      .filter((r) => r.pb_uuid && r.date)
      .map((r) => ({
        uuid: r.pb_uuid!,
        activity_date: r.date!.toISOString().substring(0, 10) + " 00:00:00",
      }));

    const streakMap = computeStreaks(sessions);

    let updated = 0;
    for (const r of rows) {
      if (!r.pb_uuid) continue;
      const streak = streakMap.get(r.pb_uuid) ?? 1;
      await db.update(meditations).set({ streak }).where(eq(meditations.id, r.id));
      updated++;
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur recalcul streaks" }, { status: 500 });
  }
}
