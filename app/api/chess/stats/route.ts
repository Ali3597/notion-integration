import { NextResponse } from "next/server";
import { fetchChessStats } from "@/lib/chess";
import {
  CHESS_RATING_DB,
  CHESS_OPENINGS_DB,
  CHESS_DAILY_DB,
  CHESS_PUZZLES_DB,
  CHESS_FORMATS_DB,
  setupAllChessDatabases,
  type ChessDbIds,
} from "@/lib/notion-client";
import fs from "fs";
import path from "path";

const DB_KEYS = [
  "NOTION_CHESS_RATING_DB",
  "NOTION_CHESS_OPENINGS_DB",
  "NOTION_CHESS_DAILY_DB",
  "NOTION_CHESS_PUZZLES_DB",
  "NOTION_CHESS_FORMATS_DB",
] as const;

// Lire process.env en temps réel (pas les constantes du module, figées au boot)
function getDbStatus() {
  return {
    NOTION_CHESS_RATING_DB:   !!process.env.NOTION_CHESS_RATING_DB,
    NOTION_CHESS_OPENINGS_DB: !!process.env.NOTION_CHESS_OPENINGS_DB,
    NOTION_CHESS_DAILY_DB:    !!process.env.NOTION_CHESS_DAILY_DB,
    NOTION_CHESS_PUZZLES_DB:  !!process.env.NOTION_CHESS_PUZZLES_DB,
    NOTION_CHESS_FORMATS_DB:  !!process.env.NOTION_CHESS_FORMATS_DB,
  };
}

// Injecte les IDs dans process.env immédiatement après écriture dans .env.local
// pour éviter qu'un deuxième appel relance le setup avant le redémarrage
function injectEnvIds(ids: ChessDbIds) {
  for (const key of DB_KEYS) {
    process.env[key] = ids[key];
  }
}

function writeChessIdsToEnvLocal(ids: ChessDbIds) {
  const envPath = path.join(process.cwd(), ".env.local");
  let content = fs.readFileSync(envPath, "utf-8");

  for (const key of DB_KEYS) {
    const value = ids[key];
    const regex = new RegExp(`^(${key}=).*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, content, "utf-8");
}

export async function GET() {
  const username = process.env.CHESS_USERNAME;
  if (!username) {
    return NextResponse.json({ error: "CHESS_USERNAME non configuré." }, { status: 500 });
  }

  const parentPageId = process.env.NOTION_CHESS_PARENT_PAGE_ID;
  const dbStatus = getDbStatus();
  const allConfigured = Object.values(dbStatus).every(Boolean);

  // Auto-setup : si parent page fournie et au moins une DB manquante
  if (!allConfigured && parentPageId) {
    try {
      const ids = await setupAllChessDatabases(parentPageId);
      writeChessIdsToEnvLocal(ids);
      injectEnvIds(ids);
      return NextResponse.json({
        username,
        stats: null,
        dbStatus: Object.fromEntries(DB_KEYS.map((k) => [k, true])),
        setupDone: true,
        restartRequired: true,
        createdIds: ids,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: `Erreur création bases Notion : ${err.message}` },
        { status: 500 }
      );
    }
  }

  try {
    const stats = await fetchChessStats(username);
    return NextResponse.json({ username, stats, dbStatus, setupDone: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur API Chess.com" }, { status: 500 });
  }
}
