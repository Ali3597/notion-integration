import type { ParsedGame, ChessStats } from "@/types";

const HEADERS = { "User-Agent": "notion-hub/1.0 contact@gmail.com" };
const BASE = "https://api.chess.com/pub";

async function chessGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Chess.com ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchChessStats(username: string): Promise<ChessStats> {
  return chessGet<ChessStats>(`/player/${username}/stats`);
}

export async function fetchArchives(username: string): Promise<string[]> {
  const data = await chessGet<{ archives: string[] }>(`/player/${username}/games/archives`);
  return data.archives ?? [];
}

export async function fetchGamesForMonth(archiveUrl: string): Promise<any[]> {
  const res = await fetch(archiveUrl, { headers: HEADERS });
  if (!res.ok) return [];
  const data: any = await res.json();
  return data.games ?? [];
}

export function timeControlToFormat(tc: string): string {
  const secs = parseInt(tc.split("+")[0], 10);
  if (isNaN(secs)) return "daily";
  if (secs < 600)  return "blitz";
  if (secs < 1800) return "rapid";
  return "daily";
}

export function parsePGN(pgn: string): Omit<ParsedGame, "pgn" | "url" | "endTime"> {
  const tag = (name: string): string => {
    const m = pgn.match(new RegExp(`\\[${name}\\s+"([^"]*)"\\]`));
    return m ? m[1] : "";
  };

  // ECOUrl is the primary source for opening name on Chess.com
  // e.g. [ECOUrl "https://www.chess.com/openings/Sicilian-Defense"]
  const ecoUrl = tag("ECOUrl");
  let opening = tag("Opening");
  if (!opening && ecoUrl) {
    const lastSegment = ecoUrl.replace(/\/$/, "").split("/").pop() ?? "";
    opening = lastSegment.replace(/-/g, " ");
  }
  if (!opening) opening = tag("ECO"); // last resort: use ECO code

  return {
    eco: tag("ECO"),
    opening,
    white: tag("White"),
    black: tag("Black"),
    whiteElo: parseInt(tag("WhiteElo"), 10) || 0,
    blackElo: parseInt(tag("BlackElo"), 10) || 0,
    date: tag("Date"),
    result: tag("Result") as ParsedGame["result"],
    timeControl: tag("TimeControl"),
  };
}

export function parseGames(rawGames: any[], _username: string): ParsedGame[] {
  return rawGames.map((g) => {
    const parsed = parsePGN(g.pgn ?? "");
    return {
      ...parsed,
      pgn: g.pgn ?? "",
      url: g.url,
      endTime: g.end_time,
    };
  });
}

/** Returns the N last archive URLs */
export function lastNArchives(archives: string[], n: number): string[] {
  return archives.slice(-n);
}

/** Returns archives needed to cover a short period (yesterday / current week) */
export function archivesForPeriod(archives: string[], period: "week" | "yesterday"): string[] {
  const now = new Date();
  // For safety, take last 2 months to handle month boundaries
  const needed = period === "yesterday" ? 2 : 2;
  return archives.slice(-needed);
}

export function filterGamesByPeriod(games: ParsedGame[], period: "week" | "yesterday"): ParsedGame[] {
  const now = new Date();
  let from: Date, to: Date;

  if (period === "yesterday") {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    from = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
    to   = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
  } else {
    // current week: Monday 00:00 → now
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    from = monday;
    to   = now;
  }

  return games.filter((g) => {
    const ts = g.endTime ? g.endTime * 1000 : Date.parse(g.date.replace(/\./g, "-"));
    return ts >= from.getTime() && ts <= to.getTime();
  });
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
