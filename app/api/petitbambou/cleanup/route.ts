import { NextResponse } from "next/server";
import { MEDITATIONS_DB, cleanupMeditationsDBSchema, deduplicateMeditations } from "@/lib/notion";

export async function POST() {
  if (!MEDITATIONS_DB) {
    return NextResponse.json({ error: "NOTION_MEDITATIONS_DB non configuré" }, { status: 400 });
  }
  try {
    // Ajoute le champ Timestamp si absent (migration)
    await cleanupMeditationsDBSchema(MEDITATIONS_DB);
    const { removed } = await deduplicateMeditations(MEDITATIONS_DB);
    return NextResponse.json({ removed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[petitbambou/cleanup]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
