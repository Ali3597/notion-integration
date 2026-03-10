import { notion } from "@/lib/notion-client";
import { timeControlToFormat } from "@/lib/chess";
import type { ParsedGame, ChessStats } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function findPage(dbId: string, titleProp: string, value: string): Promise<string | null> {
  const res: any = await notion.databases.query({
    database_id: dbId,
    filter: { property: titleProp, title: { equals: value } },
    page_size: 1,
  });
  return res.results[0]?.id ?? null;
}

/** Récupère toutes les pages d'une DB (pagination complète) en le moins de requêtes possible */
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

/** Exécute fn sur tous les items en lots parallèles de batchSize */
async function batchRun<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

function winRate(w: number, l: number, d: number): number {
  const total = w + l + d;
  if (total === 0) return 0;
  return Math.round((w / total) * 100);
}

// ─── MODULE 1 — Rating history (Blitz + Rapid only) ──────────────────────────

export async function syncRatingHistory(
  dbId: string,
  stats: ChessStats,
  monthLabel: string
): Promise<void> {
  const blitz = stats.chess_blitz?.last?.rating ?? null;
  const rapid = stats.chess_rapid?.last?.rating ?? null;

  // Compute previous month label
  const [year, month] = monthLabel.split("-").map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevLabel = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  // Fetch previous month entry for delta calculation
  let blitzDelta: number | null = null;
  let rapidDelta: number | null = null;

  const prevPageId = await findPage(dbId, "Mois", prevLabel);
  if (prevPageId) {
    const prevPage: any = await notion.pages.retrieve({ page_id: prevPageId });
    const prevBlitz = prevPage.properties?.["Blitz ELO"]?.number ?? null;
    const prevRapid = prevPage.properties?.["Rapid ELO"]?.number ?? null;
    if (blitz !== null && prevBlitz !== null) blitzDelta = blitz - prevBlitz;
    if (rapid !== null && prevRapid !== null) rapidDelta = rapid - prevRapid;
  }

  const existing = await findPage(dbId, "Mois", monthLabel);
  const props: any = {
    Mois: { title: [{ text: { content: monthLabel } }] },
    ...(blitz      !== null && { "Blitz ELO": { number: blitz      } }),
    ...(rapid      !== null && { "Rapid ELO": { number: rapid      } }),
    ...(blitzDelta !== null && { "Blitz Δ":   { number: blitzDelta } }),
    ...(rapidDelta !== null && { "Rapid Δ":   { number: rapidDelta } }),
  };

  if (existing) {
    await notion.pages.update({ page_id: existing, properties: props });
  } else {
    await notion.pages.create({ parent: { database_id: dbId }, properties: props });
  }
}

// ─── MODULE 2 — Openings (Blitz + Rapid only) ────────────────────────────────

interface OpeningRow {
  opening: string;
  eco: string;
  color: "Blanc" | "Noir";
  win: number;
  loss: number;
  draw: number;
  formats: Set<string>;
}

export async function syncOpenings(
  dbId: string,
  games: ParsedGame[],
  username: string
): Promise<void> {
  const map = new Map<string, OpeningRow>();

  for (const g of games) {
    const isWhite = g.white.toLowerCase() === username.toLowerCase();
    const color: "Blanc" | "Noir" = isWhite ? "Blanc" : "Noir";
    const opening = g.opening || g.eco || "Unknown";
    const key = `${opening}|${color}`;

    let row = map.get(key);
    if (!row) {
      row = { opening, eco: g.eco, color, win: 0, loss: 0, draw: 0, formats: new Set() };
      map.set(key, row);
    }
    if (g.result === "1/2-1/2") row.draw++;
    else if ((g.result === "1-0" && isWhite) || (g.result === "0-1" && !isWhite)) row.win++;
    else row.loss++;

    row.formats.add(timeControlToFormat(g.timeControl));
  }

  // Pré-charger toutes les pages existantes en une seule passe paginée
  const existingPages = await fetchAllPages(dbId);
  const existingIndex = new Map<string, string>(); // "opening|color" → pageId
  for (const page of existingPages) {
    const o = page.properties?.Ouverture?.title?.[0]?.plain_text ?? "";
    const c = page.properties?.Couleur?.select?.name ?? "";
    if (o && c) existingIndex.set(`${o}|${c}`, page.id);
  }

  const rows = [...map.values()].filter((r) => r.win + r.loss + r.draw >= 20);

  await batchRun(rows, 5, async (row) => {
    const total = row.win + row.loss + row.draw;
    const wr = winRate(row.win, row.loss, row.draw);
    const pageId = existingIndex.get(`${row.opening}|${row.color}`) ?? null;

    const props: any = {
      Ouverture:        { title: [{ text: { content: row.opening } }] },
      ECO:              { rich_text: [{ text: { content: row.eco } }] },
      Couleur:          { select: { name: row.color } },
      "Parties jouées": { number: total },
      Victoires:        { number: row.win },
      Défaites:         { number: row.loss },
      Nulles:           { number: row.draw },
      "Win Rate %":     { number: wr },
      Format:           { multi_select: [...row.formats].map((f) => ({ name: f })) },
    };

    if (pageId) {
      await notion.pages.update({ page_id: pageId, properties: props });
    } else {
      await notion.pages.create({ parent: { database_id: dbId }, properties: props });
    }
  });
}

// ─── MODULE 3 — Daily journal (Blitz + Rapid séparés) ───────────────────────

interface FormatDayRow {
  win: number;
  loss: number;
  draw: number;
  // Games sorted by endTime to compute ELO delta
  gamesSorted: ParsedGame[];
}

interface DayRow {
  blitz: FormatDayRow;
  rapid: FormatDayRow;
}

function eloForGame(g: ParsedGame, username: string): number {
  return g.white.toLowerCase() === username.toLowerCase() ? g.whiteElo : g.blackElo;
}

function eloDelta(games: ParsedGame[], username: string): number | null {
  if (games.length < 2) return null;
  const first = eloForGame(games[0], username);
  const last  = eloForGame(games[games.length - 1], username);
  if (!first || !last) return null;
  return last - first;
}

export async function syncDailyJournal(
  dbId: string,
  games: ParsedGame[],
  username: string
): Promise<void> {
  const byDay = new Map<string, DayRow>();

  for (const g of games) {
    const ts = g.endTime ? g.endTime * 1000 : Date.parse(g.date.replace(/\./g, "-"));
    const day = new Date(ts).toISOString().substring(0, 10);
    const fmt = timeControlToFormat(g.timeControl);
    if (fmt !== "blitz" && fmt !== "rapid") continue;

    if (!byDay.has(day)) {
      byDay.set(day, {
        blitz: { win: 0, loss: 0, draw: 0, gamesSorted: [] },
        rapid: { win: 0, loss: 0, draw: 0, gamesSorted: [] },
      });
    }
    const row = byDay.get(day)![fmt as "blitz" | "rapid"];

    const isWhite = g.white.toLowerCase() === username.toLowerCase();
    if (g.result === "1/2-1/2") row.draw++;
    else if ((g.result === "1-0" && isWhite) || (g.result === "0-1" && !isWhite)) row.win++;
    else row.loss++;

    row.gamesSorted.push(g);
  }

  // Sort each format's games by endTime
  for (const row of byDay.values()) {
    row.blitz.gamesSorted.sort((a, b) => (a.endTime ?? 0) - (b.endTime ?? 0));
    row.rapid.gamesSorted.sort((a, b) => (a.endTime ?? 0) - (b.endTime ?? 0));
  }

  // Pré-charger toutes les pages existantes en une seule passe paginée
  const existingPages = await fetchAllPages(dbId);
  const existingIndex = new Map<string, string>(); // "YYYY-MM-DD" → pageId
  for (const page of existingPages) {
    const d = page.properties?.Date?.title?.[0]?.plain_text ?? "";
    if (d) existingIndex.set(d, page.id);
  }

  await batchRun([...byDay.entries()], 5, async ([day, row]) => {
    const bDelta = eloDelta(row.blitz.gamesSorted, username);
    const rDelta = eloDelta(row.rapid.gamesSorted, username);
    const pageId = existingIndex.get(day) ?? null;

    const props: any = {
      Date: { title: [{ text: { content: day } }] },
      "Blitz Parties":    { number: row.blitz.win + row.blitz.loss + row.blitz.draw },
      "Blitz Victoires":  { number: row.blitz.win },
      "Blitz Défaites":   { number: row.blitz.loss },
      "Blitz Nulles":     { number: row.blitz.draw },
      "Blitz Win Rate %": { number: winRate(row.blitz.win, row.blitz.loss, row.blitz.draw) },
      ...(bDelta !== null && { "Blitz Δ ELO": { number: bDelta } }),
      "Rapid Parties":    { number: row.rapid.win + row.rapid.loss + row.rapid.draw },
      "Rapid Victoires":  { number: row.rapid.win },
      "Rapid Défaites":   { number: row.rapid.loss },
      "Rapid Nulles":     { number: row.rapid.draw },
      "Rapid Win Rate %": { number: winRate(row.rapid.win, row.rapid.loss, row.rapid.draw) },
      ...(rDelta !== null && { "Rapid Δ ELO": { number: rDelta } }),
    };

    if (pageId) {
      await notion.pages.update({ page_id: pageId, properties: props });
    } else {
      await notion.pages.create({ parent: { database_id: dbId }, properties: props });
    }
  });
}

// ─── MODULE 4 — Puzzles (Date + Puzzle Rating only) ──────────────────────────

export async function syncPuzzles(dbId: string, stats: ChessStats): Promise<void> {
  const today = new Date().toISOString().substring(0, 10);
  const puzzleRating = stats.tactics?.highest?.rating ?? null;

  const props: any = {
    Date: { title: [{ text: { content: today } }] },
    ...(puzzleRating !== null && { "Puzzle Rating": { number: puzzleRating } }),
  };

  const existing = await findPage(dbId, "Date", today);
  if (existing) {
    await notion.pages.update({ page_id: existing, properties: props });
  } else {
    await notion.pages.create({ parent: { database_id: dbId }, properties: props });
  }
}

// ─── MODULE 5 — Formats (Blitz + Rapid only) ─────────────────────────────────

export async function syncFormats(dbId: string, stats: ChessStats): Promise<void> {
  const formats: Array<{ label: string; key: keyof ChessStats }> = [
    { label: "Blitz", key: "chess_blitz" },
    { label: "Rapid", key: "chess_rapid" },
  ];
  const today = new Date().toISOString().substring(0, 10);

  for (const { label, key } of formats) {
    const fmt = stats[key] as any;
    if (!fmt) continue;

    const elo     = fmt.last?.rating ?? null;
    const bestElo = fmt.best?.rating ?? null;
    const w = fmt.record?.win  ?? 0;
    const l = fmt.record?.loss ?? 0;
    const d = fmt.record?.draw ?? 0;
    const total = w + l + d;
    const wr = winRate(w, l, d);

    const pageId = await findPage(dbId, "Format", label);
    const props: any = {
      Format: { title: [{ text: { content: label } }] },
      ...(elo     !== null && { "ELO actuel": { number: elo     } }),
      ...(bestElo !== null && { "Best ELO":   { number: bestElo } }),
      "Parties totales": { number: total },
      Victoires:         { number: w },
      Défaites:          { number: l },
      Nulles:            { number: d },
      "Win Rate %":      { number: wr },
      "Dernière MAJ":    { date: { start: today } },
    };

    if (pageId) {
      await notion.pages.update({ page_id: pageId, properties: props });
    } else {
      await notion.pages.create({ parent: { database_id: dbId }, properties: props });
    }
  }
}
