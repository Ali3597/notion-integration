import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recipe_categories } from "@/lib/schema";
import { eq, asc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(recipe_categories)
      .orderBy(asc(recipe_categories.name));
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, icon } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    const [row] = await db
      .insert(recipe_categories)
      .values({ name: name.trim(), icon: icon || null })
      .returning();
    return NextResponse.json(row);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const body = await req.json();
    const { name, icon } = body;
    const [row] = await db
      .update(recipe_categories)
      .set({
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(icon !== undefined ? { icon: icon || null } : {}),
      })
      .where(eq(recipe_categories.id, id))
      .returning();
    return NextResponse.json(row);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await db.delete(recipe_categories).where(eq(recipe_categories.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
