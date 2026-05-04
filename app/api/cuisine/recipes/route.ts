import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recipes, recipe_categories, recipe_ingredients } from "@/lib/schema";
import { eq, asc, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      // Single recipe with full ingredients
      const rows = await db
        .select({
          id: recipes.id,
          title: recipes.title,
          category_id: recipes.category_id,
          category_name: recipe_categories.name,
          category_icon: recipe_categories.icon,
          servings: recipes.servings,
          prep_time: recipes.prep_time,
          cook_time: recipes.cook_time,
          steps: recipes.steps,
          notes: recipes.notes,
          created_at: recipes.created_at,
          updated_at: recipes.updated_at,
        })
        .from(recipes)
        .leftJoin(recipe_categories, eq(recipes.category_id, recipe_categories.id))
        .where(eq(recipes.id, id));

      if (!rows[0]) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

      const ingredients = await db
        .select()
        .from(recipe_ingredients)
        .where(eq(recipe_ingredients.recipe_id, id))
        .orderBy(asc(recipe_ingredients.sort_order), asc(recipe_ingredients.created_at));

      return NextResponse.json({ ...rows[0], ingredients });
    }

    // All recipes with ingredient count and names for search
    const rows = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        category_id: recipes.category_id,
        category_name: recipe_categories.name,
        category_icon: recipe_categories.icon,
        servings: recipes.servings,
        prep_time: recipes.prep_time,
        cook_time: recipes.cook_time,
        steps: recipes.steps,
        notes: recipes.notes,
        created_at: recipes.created_at,
        updated_at: recipes.updated_at,
        ingredient_count: sql<number>`(select count(*) from recipe_ingredients ri where ri.recipe_id = ${recipes.id})`,
        ingredient_names: sql<string>`(select string_agg(ri.name, ', ') from recipe_ingredients ri where ri.recipe_id = ${recipes.id})`,
      })
      .from(recipes)
      .leftJoin(recipe_categories, eq(recipes.category_id, recipe_categories.id))
      .orderBy(desc(recipes.created_at));

    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, category_id, servings, prep_time, cook_time, steps, notes, ingredients } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

    const [recipe] = await db
      .insert(recipes)
      .values({
        title: title.trim(),
        category_id: category_id || null,
        servings: servings ? Number(servings) : null,
        prep_time: prep_time ? Number(prep_time) : null,
        cook_time: cook_time ? Number(cook_time) : null,
        steps: steps || null,
        notes: notes || null,
      })
      .returning();

    if (Array.isArray(ingredients) && ingredients.length > 0) {
      await db.insert(recipe_ingredients).values(
        ingredients
          .filter((ing: { name?: string }) => ing.name?.trim())
          .map((ing: { name: string; quantity?: string; unit?: string }, idx: number) => ({
            recipe_id: recipe.id,
            name: ing.name.trim(),
            quantity: ing.quantity ? String(ing.quantity) : null,
            unit: ing.unit || null,
            sort_order: idx,
          }))
      );
    }

    return NextResponse.json(recipe);
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
    const { title, category_id, servings, prep_time, cook_time, steps, notes, ingredients } = body;

    const [recipe] = await db
      .update(recipes)
      .set({
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(category_id !== undefined ? { category_id: category_id || null } : {}),
        ...(servings !== undefined ? { servings: servings ? Number(servings) : null } : {}),
        ...(prep_time !== undefined ? { prep_time: prep_time ? Number(prep_time) : null } : {}),
        ...(cook_time !== undefined ? { cook_time: cook_time ? Number(cook_time) : null } : {}),
        ...(steps !== undefined ? { steps: steps || null } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, id))
      .returning();

    if (Array.isArray(ingredients)) {
      await db.delete(recipe_ingredients).where(eq(recipe_ingredients.recipe_id, id));
      if (ingredients.length > 0) {
        await db.insert(recipe_ingredients).values(
          ingredients
            .filter((ing: { name?: string }) => ing.name?.trim())
            .map((ing: { name: string; quantity?: string; unit?: string }, idx: number) => ({
              recipe_id: id,
              name: ing.name.trim(),
              quantity: ing.quantity ? String(ing.quantity) : null,
              unit: ing.unit || null,
              sort_order: idx,
            }))
        );
      }
    }

    return NextResponse.json(recipe);
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
    await db.delete(recipes).where(eq(recipes.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
