import { Client } from "@notionhq/client";
import type { PBSession } from "@/types";
import { computeStreaks } from "@/lib/petitbambou";

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export const PROJECTS_DB = process.env.NOTION_PROJECTS_DB!;
export const TASKS_DB = process.env.NOTION_TASKS_DB!;
export const SESSIONS_DB = process.env.NOTION_SESSIONS_DB!;
export const MEDITATIONS_DB = process.env.NOTION_MEDITATIONS_DB ?? "";

export async function setupMeditationsDB(parentPageId: string): Promise<string> {
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Méditations Petit Bambou" } }],
    properties: {
      Leçon: { title: {} },
      Date: { date: {} },
      "Durée (min)": { number: { format: "number" } },
      PB_UUID: { rich_text: {} },
    },
  });
  return db.id;
}

// Supprime les colonnes obsolètes si elles existent encore
export async function cleanupMeditationsDBSchema(dbId: string): Promise<void> {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const existingProps = Object.keys((db as any).properties);

  const toRemove = ["Streak actuel", "Total leçons", "Meilleur streak", "Programme", "Timestamp"]
    .filter((col) => existingProps.includes(col));
  if (toRemove.length > 0) {
    const propsToNull = Object.fromEntries(toRemove.map((col) => [col, null]));
    await notion.databases.update({ database_id: dbId, properties: propsToNull as any });
  }
}

// Ajoute la colonne Streak si elle n'existe pas encore (idempotent)
export async function ensureStreakColumn(dbId: string): Promise<void> {
  const db = await notion.databases.retrieve({ database_id: dbId });
  if (!(db as any).properties["Streak"]) {
    await notion.databases.update({
      database_id: dbId,
      properties: { Streak: { number: {} } },
    });
  }
}

// Ajoute la colonne PB_UUID si elle n'existe pas encore (idempotent)
export async function ensurePBUUIDColumn(dbId: string): Promise<void> {
  const db = await notion.databases.retrieve({ database_id: dbId });
  if (!(db as any).properties["PB_UUID"]) {
    await notion.databases.update({
      database_id: dbId,
      properties: { PB_UUID: { rich_text: {} } },
    });
  }
}

// Récupère toutes les pages d'une DB (pagination complète)
async function fetchAllPages(dbId: string): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

// Récupère les sessions existantes dans Notion (uuid + activity_date) pour calcul de streak
export async function getExistingSessionsFromNotion(
  dbId: string
): Promise<Array<{ uuid: string; activity_date: string }>> {
  const sessions: Array<{ uuid: string; activity_date: string }> = [];
  let cursor: string | undefined;
  do {
    const res: any = await notion.databases.query({
      database_id: dbId,
      page_size: 100,
      start_cursor: cursor,
      filter: { property: "PB_UUID", rich_text: { is_not_empty: true } },
    });
    for (const page of res.results) {
      const uuid = page.properties?.PB_UUID?.rich_text?.[0]?.plain_text;
      const isoDate: string | undefined = page.properties?.Date?.date?.start;
      if (uuid && isoDate) {
        // Convertir ISO → "YYYY-MM-DD 00:00:00" pour que substring(0,10) donne la bonne date
        const datePart = isoDate.substring(0, 10);
        sessions.push({ uuid, activity_date: `${datePart} 00:00:00` });
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return sessions;
}

export async function pushMeditationSessions(
  sessions: PBSession[],
  dbId: string
): Promise<{ pushed: number; errors: number }> {
  await ensurePBUUIDColumn(dbId);
  await ensureStreakColumn(dbId);

  // Récupère les sessions existantes pour calculer les streaks sur l'historique complet
  const existingSessions = await getExistingSessionsFromNotion(dbId);
  const existingUUIDs = new Set(existingSessions.map((s) => s.uuid));

  const toCreate = sessions.filter((s) => !existingUUIDs.has(s.uuid));

  // Fusionner tout l'historique pour calculer les streaks correctement
  const allSessions = [
    ...existingSessions,
    ...toCreate.map((s) => ({ uuid: s.uuid, activity_date: s.activity_date })),
  ];
  const streakMap = computeStreaks(allSessions);

  let pushed = 0;
  let errors = 0;

  for (const s of toCreate) {
    try {
      const durationMin = Math.round(s.duration / 60);
      const isoDate = new Date(parseInt(s.activity_time, 10) * 1000).toISOString();

      await notion.pages.create({
        parent: { database_id: dbId },
        properties: {
          Leçon: { title: [{ text: { content: s.lesson_name } }] },
          Date: { date: { start: isoDate } },
          "Durée (min)": { number: durationMin },
          PB_UUID: { rich_text: [{ text: { content: s.uuid } }] },
          Streak: { number: streakMap.get(s.uuid) ?? 1 },
        },
      });
      pushed++;
    } catch {
      errors++;
    }
  }

  return { pushed, errors };
}

// Supprime les doublons en se basant sur PB_UUID (clé primaire unique par session)
export async function deduplicateMeditations(dbId: string): Promise<{ removed: number }> {
  const pages = await fetchAllPages(dbId);

  // Grouper par PB_UUID
  const groups = new Map<string, any[]>();
  for (const page of pages) {
    const uuid = page.properties?.PB_UUID?.rich_text?.[0]?.plain_text;
    if (!uuid) continue;
    if (!groups.has(uuid)) groups.set(uuid, []);
    groups.get(uuid)!.push(page);
  }

  let removed = 0;
  for (const [, group] of groups) {
    if (group.length <= 1) continue;
    // Garder la plus ancienne, supprimer les autres définitivement
    group.sort((a, b) =>
      new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
    );
    for (const page of group.slice(1)) {
      try {
        await notion.pages.update({ page_id: page.id, archived: true });
        removed++;
      } catch {}
    }
  }

  return { removed };
}
