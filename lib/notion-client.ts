// Minimal Notion client kept for the Chess.com integration only.
// Pomodoro and Petit Bambou use PostgreSQL (lib/db.ts).
import { Client } from "@notionhq/client";

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

export const CHESS_RATING_DB   = process.env.NOTION_CHESS_RATING_DB   ?? "";
export const CHESS_OPENINGS_DB = process.env.NOTION_CHESS_OPENINGS_DB ?? "";
export const CHESS_DAILY_DB    = process.env.NOTION_CHESS_DAILY_DB    ?? "";
export const CHESS_PUZZLES_DB  = process.env.NOTION_CHESS_PUZZLES_DB  ?? "";
export const CHESS_FORMATS_DB  = process.env.NOTION_CHESS_FORMATS_DB  ?? "";

export interface ChessDbIds {
  NOTION_CHESS_RATING_DB:   string;
  NOTION_CHESS_OPENINGS_DB: string;
  NOTION_CHESS_DAILY_DB:    string;
  NOTION_CHESS_PUZZLES_DB:  string;
  NOTION_CHESS_FORMATS_DB:  string;
}

export async function setupAllChessDatabases(parentPageId: string): Promise<ChessDbIds> {
  const p = parentPageId;
  const [rating, openings, daily, puzzles, formats] = await Promise.all([
    notion.databases.create({
      parent: { type: "page_id", page_id: p },
      title: [{ type: "text", text: { content: "Chess — Rating History" } }],
      properties: {
        Mois:        { title: {} },
        "Blitz ELO": { number: { format: "number" } },
        "Rapid ELO": { number: { format: "number" } },
        "Blitz Δ":   { number: { format: "number" } },
        "Rapid Δ":   { number: { format: "number" } },
      },
    }),
    notion.databases.create({
      parent: { type: "page_id", page_id: p },
      title: [{ type: "text", text: { content: "Chess — Openings" } }],
      properties: {
        Ouverture:        { title: {} },
        ECO:              { rich_text: {} },
        Couleur:          { select: { options: [{ name: "Blanc" }, { name: "Noir" }] } },
        "Parties jouées": { number: { format: "number" } },
        Victoires:        { number: { format: "number" } },
        Défaites:         { number: { format: "number" } },
        Nulles:           { number: { format: "number" } },
        "Win Rate %":     { number: { format: "number" } },
        Format:           { multi_select: { options: [{ name: "blitz" }, { name: "rapid" }] } },
      },
    }),
    notion.databases.create({
      parent: { type: "page_id", page_id: p },
      title: [{ type: "text", text: { content: "Chess — Daily Journal" } }],
      properties: {
        Date:               { title: {} },
        "Blitz Parties":    { number: { format: "number" } },
        "Blitz Victoires":  { number: { format: "number" } },
        "Blitz Défaites":   { number: { format: "number" } },
        "Blitz Nulles":     { number: { format: "number" } },
        "Blitz Win Rate %": { number: { format: "number" } },
        "Blitz Δ ELO":      { number: { format: "number" } },
        "Rapid Parties":    { number: { format: "number" } },
        "Rapid Victoires":  { number: { format: "number" } },
        "Rapid Défaites":   { number: { format: "number" } },
        "Rapid Nulles":     { number: { format: "number" } },
        "Rapid Win Rate %": { number: { format: "number" } },
        "Rapid Δ ELO":      { number: { format: "number" } },
      },
    }),
    notion.databases.create({
      parent: { type: "page_id", page_id: p },
      title: [{ type: "text", text: { content: "Chess — Puzzles" } }],
      properties: {
        Date:            { title: {} },
        "Puzzle Rating": { number: { format: "number" } },
      },
    }),
    notion.databases.create({
      parent: { type: "page_id", page_id: p },
      title: [{ type: "text", text: { content: "Chess — Formats" } }],
      properties: {
        Format:            { title: {} },
        "ELO actuel":      { number: { format: "number" } },
        "Best ELO":        { number: { format: "number" } },
        "Parties totales": { number: { format: "number" } },
        Victoires:         { number: { format: "number" } },
        Défaites:          { number: { format: "number" } },
        Nulles:            { number: { format: "number" } },
        "Win Rate %":      { number: { format: "number" } },
        "Dernière MAJ":    { date: {} },
      },
    }),
  ]);
  return {
    NOTION_CHESS_RATING_DB:   rating.id,
    NOTION_CHESS_OPENINGS_DB: openings.id,
    NOTION_CHESS_DAILY_DB:    daily.id,
    NOTION_CHESS_PUZZLES_DB:  puzzles.id,
    NOTION_CHESS_FORMATS_DB:  formats.id,
  };
}
