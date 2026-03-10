import { NextResponse } from "next/server";
import { MEDITATIONS_DB, notion, ensureStreakColumn } from "@/lib/notion";
import { computeStreaks } from "@/lib/petitbambou";

export async function POST() {
  try {
    const dbId = MEDITATIONS_DB;
    if (!dbId) {
      return NextResponse.json(
        { error: "NOTION_MEDITATIONS_DB non configuré." },
        { status: 400 }
      );
    }

    await ensureStreakColumn(dbId);

    // Récupère toutes les pages Notion avec pagination complète
    const allPages: any[] = [];
    let cursor: string | undefined;
    do {
      const res: any = await notion.databases.query({
        database_id: dbId,
        page_size: 100,
        start_cursor: cursor,
        filter: { property: "PB_UUID", rich_text: { is_not_empty: true } },
      });
      allPages.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    // Extraire uuid + activity_date depuis chaque page
    const sessions: Array<{ uuid: string; activity_date: string; pageId: string }> = [];
    for (const page of allPages) {
      const uuid = page.properties?.PB_UUID?.rich_text?.[0]?.plain_text;
      const isoDate: string | undefined = page.properties?.Date?.date?.start;
      if (uuid && isoDate) {
        const datePart = isoDate.substring(0, 10);
        sessions.push({ uuid, activity_date: `${datePart} 00:00:00`, pageId: page.id });
      }
    }

    const streakMap = computeStreaks(sessions);

    // Mettre à jour toutes les pages
    let updated = 0;
    for (const s of sessions) {
      try {
        await notion.pages.update({
          page_id: s.pageId,
          properties: {
            Streak: { number: streakMap.get(s.uuid) ?? 1 },
          },
        });
        updated++;
      } catch {
        // Continuer si une page échoue
      }
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur recalcul streaks" }, { status: 500 });
  }
}
