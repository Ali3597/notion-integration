import { NextRequest, NextResponse } from "next/server";
import { fetchArchives, fetchGamesForMonth, parseGames, lastNArchives, sleep } from "@/lib/chess";

export async function GET(req: NextRequest) {
  const username = process.env.CHESS_USERNAME;
  if (!username) {
    return NextResponse.json({ error: "CHESS_USERNAME non configuré." }, { status: 500 });
  }

  const months = parseInt(req.nextUrl.searchParams.get("months") ?? "3", 10);

  try {
    const archives = await fetchArchives(username);
    const urls = lastNArchives(archives, months);

    const allGames: any[] = [];
    for (const url of urls) {
      const raw = await fetchGamesForMonth(url);
      const parsed = parseGames(raw, username);
      allGames.push(...parsed);
      if (urls.indexOf(url) < urls.length - 1) await sleep(300);
    }

    return NextResponse.json({ games: allGames, total: allGames.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur" }, { status: 500 });
  }
}
