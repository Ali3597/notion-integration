import { NextRequest, NextResponse } from "next/server";
import {
  fetchArchives,
  fetchGamesForMonth,
  fetchChessStats,
  parseGames,
  lastNArchives,
  archivesForPeriod,
  filterGamesByPeriod,
  timeControlToFormat,
  sleep,
} from "@/lib/chess";
import {
  syncRatingHistory,
  syncOpenings,
  syncDailyJournal,
  syncPuzzles,
  syncFormats,
} from "@/lib/chess-notion";
import {
  CHESS_RATING_DB,
  CHESS_OPENINGS_DB,
  CHESS_DAILY_DB,
  CHESS_PUZZLES_DB,
  CHESS_FORMATS_DB,
} from "@/lib/notion-client";

export async function POST(req: NextRequest) {
  const username = process.env.CHESS_USERNAME;
  if (!username) {
    return NextResponse.json({ error: "CHESS_USERNAME non configuré." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const months: number = body.months ?? 3;
  const period: "week" | "yesterday" | undefined = body.period;

  const t0 = Date.now();

  try {
    const archives = await fetchArchives(username);

    // For short periods (week/yesterday) we only need the last 2 months
    const urls = period
      ? archivesForPeriod(archives, period)
      : lastNArchives(archives, months);

    const allRaw: any[] = [];
    for (let i = 0; i < urls.length; i++) {
      const raw = await fetchGamesForMonth(urls[i]);
      allRaw.push(...raw);
      if (i < urls.length - 1) await sleep(300);
    }

    let games = parseGames(allRaw, username);

    // Filter to blitz + rapid only
    games = games.filter((g) => {
      const fmt = timeControlToFormat(g.timeControl);
      return fmt === "blitz" || fmt === "rapid";
    });

    // Further filter by time period if requested
    if (period) {
      games = filterGamesByPeriod(games, period);
    }

    const stats = await fetchChessStats(username);

    const now = new Date();
    const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const moduleNames = [
      "📈 Rating",
      "♟️ Openings",
      "🗓️ Daily",
      "🧩 Puzzles",
      "⏱️ Formats",
    ];

    const results = await Promise.allSettled([
      CHESS_RATING_DB   ? syncRatingHistory(CHESS_RATING_DB,  stats, monthLabel)  : Promise.resolve(),
      CHESS_OPENINGS_DB ? syncOpenings(CHESS_OPENINGS_DB, games, username)        : Promise.resolve(),
      CHESS_DAILY_DB    ? syncDailyJournal(CHESS_DAILY_DB, games, username)       : Promise.resolve(),
      CHESS_PUZZLES_DB  ? syncPuzzles(CHESS_PUZZLES_DB,    stats)                 : Promise.resolve(),
      CHESS_FORMATS_DB  ? syncFormats(CHESS_FORMATS_DB,    stats)                 : Promise.resolve(),
    ]);

    const successModules = moduleNames.filter((_, i) => results[i].status === "fulfilled");
    const failedModules  = moduleNames.filter((_, i) => results[i].status === "rejected");

    return NextResponse.json({
      synced: true,
      gamesProcessed: games.length,
      modules: successModules,
      failedModules,
      durationMs: Date.now() - t0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur sync" }, { status: 500 });
  }
}
