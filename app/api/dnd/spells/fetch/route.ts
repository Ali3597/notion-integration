import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dnd_spells } from "@/lib/schema";
import { eq } from "drizzle-orm";

// Aidedd.org structure (single-quoted class attrs, <strong> labels):
// <h1>Nom du sort</h1>
// <div class='ecole'>niveau X - École</div>
// <div class='t'><strong>Temps d'incantation</strong> : ...</div>
// <div class='r'><strong>Portée</strong> : ...</div>
// <div class='c'><strong>Composantes</strong> : ...</div>
// <div class='d'><strong>Durée</strong> : ...</div>
// <div class='description'>Texte...<br></div>

function attr(cls: string) {
  // Match both class="x" and class='x'
  return `class=(?:"${cls}"|'${cls}')`;
}

function extractDivContent(html: string, cls: string): string | null {
  const re = new RegExp(`<div\\s+${attr(cls)}[^>]*>([\\s\\S]*?)<\\/div>`, "i");
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<strong><em>(.*?)<\/em><\/strong>/gi, "$1")
    .replace(/<em><strong>(.*?)<\/strong><\/em>/gi, "$1")
    .replace(/<strong>(.*?)<\/strong>/gi, "$1")
    .replace(/<em>(.*?)<\/em>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extract just the text value after "Label : value" in a div
function extractFieldValue(raw: string | null): string | null {
  if (!raw) return null;
  // Strip the <strong>Label</strong> prefix and the colon
  const cleaned = raw.replace(/<strong>[^<]*<\/strong>\s*:\s*/i, "");
  return htmlToText(cleaned) || null;
}

function parseSpellFromHtml(html: string) {
  // Name from <h1> inside col1
  const h1Match = html.match(/<h1>([^<]+)<\/h1>/i);
  const name = h1Match ? h1Match[1].trim() : null;

  // Level + school from ecole div
  const ecoleRaw = extractDivContent(html, "ecole");
  const ecoleText = ecoleRaw ? htmlToText(ecoleRaw) : "";
  let level = 0;
  let school: string | null = null;
  const lvlMatch = ecoleText.match(/niveau\s+(\d+)/i);
  if (lvlMatch) level = parseInt(lvlMatch[1], 10);
  // format: "niveau 3 - abjuration" or "tour de magie - école"
  const schoolMatch = ecoleText.match(/[-–—]\s*(.+)$/);
  if (schoolMatch) {
    school = schoolMatch[1].trim();
    school = school.charAt(0).toUpperCase() + school.slice(1);
  }

  // Fields — each in its own div with single-letter class
  const casting_time = extractFieldValue(extractDivContent(html, "t"));
  const range       = extractFieldValue(extractDivContent(html, "r"));
  const components  = extractFieldValue(extractDivContent(html, "c"));
  const duration    = extractFieldValue(extractDivContent(html, "d"));

  // Description
  const descRaw = extractDivContent(html, "description");
  const description = descRaw ? htmlToText(descRaw) : null;

  return { name, level, school, casting_time, range, components, duration, description };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get("url");
  if (!urlParam) return NextResponse.json({ error: "url requis" }, { status: 400 });

  const spellUrl = decodeURIComponent(urlParam);

  // Check cache in DB
  const existing = await db.select().from(dnd_spells).where(eq(dnd_spells.url, spellUrl)).limit(1);
  const spell = existing[0];

  if (spell && spell.school && spell.casting_time && spell.description) {
    return NextResponse.json(spell);
  }

  // Fetch from aidedd.org server-side
  try {
    const res = await fetch(spellUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const parsed = parseSpellFromHtml(html);

    if (spell) {
      const updates: Record<string, unknown> = {};
      if (!spell.school && parsed.school)             updates.school = parsed.school;
      if (!spell.casting_time && parsed.casting_time) updates.casting_time = parsed.casting_time;
      if (!spell.range && parsed.range)               updates.range = parsed.range;
      if (!spell.components && parsed.components)     updates.components = parsed.components;
      if (!spell.duration && parsed.duration)         updates.duration = parsed.duration;
      if (!spell.description && parsed.description)   updates.description = parsed.description;

      if (Object.keys(updates).length > 0) {
        await db.update(dnd_spells).set(updates).where(eq(dnd_spells.id, spell.id));
      }

      return NextResponse.json({ ...spell, ...updates });
    }

    return NextResponse.json(parsed);
  } catch {
    if (spell) return NextResponse.json(spell);
    return NextResponse.json({ error: "Impossible de récupérer le sort" }, { status: 502 });
  }
}
