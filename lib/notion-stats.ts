import { notion } from "@/lib/notion";

export const STATS_PAGE_ID = process.env.NOTION_STATS_PAGE_ID ?? "";

export interface MeditationStats {
  totalSessions: number;
  totalMinutes: number;
  bestStreak: number;
  currentStreak: number;
}

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

// Calcule les stats directement depuis les pages Notion (jamais depuis l'API PB)
export async function computeStatsFromNotion(dbId: string): Promise<MeditationStats> {
  let totalSessions = 0;
  let totalMinutes = 0;
  let bestStreak = 0;
  let latestDateStr = "";
  let currentStreak = 0;

  let cursor: string | undefined;
  do {
    const res: any = await notion.databases.query({
      database_id: dbId,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const page of res.results) {
      totalSessions++;

      const duration: number = page.properties?.["Durée (min)"]?.number ?? 0;
      totalMinutes += duration;

      const streak: number = page.properties?.Streak?.number ?? 0;
      if (streak > bestStreak) bestStreak = streak;

      // Streak en cours = valeur Streak de la session à la date la plus récente
      const dateStr: string | undefined = page.properties?.Date?.date?.start;
      if (dateStr && dateStr > latestDateStr) {
        latestDateStr = dateStr;
        currentStreak = streak;
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return { totalSessions, totalMinutes, bestStreak, currentStreak };
}

// Met à jour les 4 callouts de la page Stats en faisant correspondre chaque emoji
export async function updateStatsCallouts(stats: MeditationStats): Promise<void> {
  if (!STATS_PAGE_ID) return;

  const res: any = await notion.blocks.children.list({ block_id: STATS_PAGE_ID });
  const blocks: any[] = res.results ?? [];

  const mapping: Record<string, string> = {
    "🏆": `Meilleure streak: ${stats.bestStreak} jours`,
    "🔥": `Streak en cours : ${stats.currentStreak} jours`,
    "⏱️": `Temps total : ${formatDuration(stats.totalMinutes)}`,
    "🧘": `Total séances: ${stats.totalSessions} séances`,
  };

  for (const block of blocks) {
    if (block.type !== "callout") continue;
    const emoji: string = block.callout?.icon?.emoji ?? "";
    const text = mapping[emoji];
    if (!text) continue;

    await notion.blocks.update({
      block_id: block.id,
      callout: {
        rich_text: [{ type: "text", text: { content: text } }],
      },
    } as any);
  }
}
