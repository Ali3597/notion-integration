import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dnd_character } from "@/lib/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(dnd_character).limit(1);
    return NextResponse.json(rows[0] ?? null);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id: _id, created_at: _ca, updated_at: _ua, ...body } = await req.json();
    const rows = await db.select({ id: dnd_character.id }).from(dnd_character).limit(1);

    if (rows.length === 0) {
      // Create new character
      const [created] = await db.insert(dnd_character).values({ ...body, updated_at: new Date() }).returning();
      return NextResponse.json(created);
    } else {
      const [updated] = await db
        .update(dnd_character)
        .set({ ...body, updated_at: new Date() })
        .where(sql`id = ${rows[0].id}`)
        .returning();
      return NextResponse.json(updated);
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
