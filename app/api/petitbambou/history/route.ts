import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meditations } from "@/lib/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: meditations.id,
        lesson: meditations.lesson,
        date: meditations.date,
        duration_min: meditations.duration_min,
        pb_uuid: meditations.pb_uuid,
        streak: meditations.streak,
      })
      .from(meditations)
      .orderBy(desc(meditations.date));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[petitbambou/history]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
