import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { project_relations } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { parent_id, child_id } = await request.json();
    if (!parent_id || !child_id) return NextResponse.json({ error: "parent_id et child_id requis" }, { status: 400 });
    if (parent_id === child_id) return NextResponse.json({ error: "Un projet ne peut pas être son propre parent" }, { status: 400 });

    // Max 2 levels: child can't have children of its own
    const childHasChildren = await db.select().from(project_relations).where(eq(project_relations.parent_id, child_id));
    if (childHasChildren.length > 0) {
      return NextResponse.json({ error: "Un sous-projet ne peut pas avoir de sous-projets" }, { status: 400 });
    }

    // Max 2 levels: parent can't already have a parent
    const parentHasParent = await db.select().from(project_relations).where(eq(project_relations.child_id, parent_id));
    if (parentHasParent.length > 0) {
      return NextResponse.json({ error: "Un sous-projet ne peut pas devenir parent" }, { status: 400 });
    }

    await db.insert(project_relations).values({ parent_id, child_id }).onConflictDoNothing();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { parent_id, child_id } = await request.json();
    if (!parent_id || !child_id) return NextResponse.json({ error: "parent_id et child_id requis" }, { status: 400 });
    await db.delete(project_relations).where(
      and(eq(project_relations.parent_id, parent_id), eq(project_relations.child_id, child_id))
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
