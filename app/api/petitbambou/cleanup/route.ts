import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meditations } from "@/lib/schema";
import { sql } from "drizzle-orm";

export async function POST() {
  try {
    // Delete duplicate rows keeping the one with the smallest id (earliest inserted)
    const result = await db.execute(sql`
      DELETE FROM meditations
      WHERE id NOT IN (
        SELECT DISTINCT ON (pb_uuid) id
        FROM meditations
        WHERE pb_uuid IS NOT NULL
        ORDER BY pb_uuid, created_at ASC
      )
      AND pb_uuid IS NOT NULL
    `);
    const removed = (result as any).rowCount ?? 0;
    return NextResponse.json({ removed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[petitbambou/cleanup]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
