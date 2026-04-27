import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finance_accounts, finance_account_snapshots } from "@/lib/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: finance_accounts.id,
        name: finance_accounts.name,
        type: finance_accounts.type,
        institution: finance_accounts.institution,
        color: finance_accounts.color,
        created_at: finance_accounts.created_at,
        latest_balance: sql<string>`(
          select balance from finance_account_snapshots s
          where s.account_id = finance_accounts.id
          order by s.date desc, s.created_at desc
          limit 1
        )`,
        latest_date: sql<string>`(
          select date from finance_account_snapshots s
          where s.account_id = finance_accounts.id
          order by s.date desc, s.created_at desc
          limit 1
        )`,
      })
      .from(finance_accounts)
      .orderBy(finance_accounts.name);
    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, institution, color } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const [account] = await db.insert(finance_accounts).values({
      name: name.trim(),
      type: type ?? "savings",
      institution: institution ?? null,
      color: color ?? "#3b7ef8",
    }).returning();
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const body = await request.json();
    const updates: Partial<typeof finance_accounts.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.type !== undefined) updates.type = body.type;
    if (body.institution !== undefined) updates.institution = body.institution;
    if (body.color !== undefined) updates.color = body.color;

    const [updated] = await db.update(finance_accounts).set(updates).where(eq(finance_accounts.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Compte non trouvé" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    await db.delete(finance_accounts).where(eq(finance_accounts.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
