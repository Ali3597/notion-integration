import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { weight_entries } from "@/lib/schema";
import { eq } from "drizzle-orm";

const FR_MONTHS: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4,
  mai: 5, juin: 6, juillet: 7, août: 8, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};

// Parses "18 mars 2026 à 16:59" or "18 mars 2026 à 16:59:00" or ISO strings
function parseDate(raw: string): Date {
  const iso = new Date(raw);
  if (!isNaN(iso.getTime())) return iso;

  // French locale format: "18 mars 2026 à 16:59"
  const m = raw.match(/(\d{1,2})\s+(\w+)\s+(\d{4})(?:\s+à\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = FR_MONTHS[m[2].toLowerCase()];
    const year = parseInt(m[3], 10);
    const hour = m[4] ? parseInt(m[4], 10) : 0;
    const min = m[5] ? parseInt(m[5], 10) : 0;
    const sec = m[6] ? parseInt(m[6], 10) : 0;
    if (month) return new Date(year, month - 1, day, hour, min, sec);
  }

  return new Date(NaN);
}

export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: Date.now() });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { measured_at, weight } = body;

  if (!measured_at || weight === undefined || weight === null) {
    return NextResponse.json({ error: "measured_at et weight sont requis" }, { status: 400 });
  }

  const measuredAt = parseDate(String(measured_at));
  if (isNaN(measuredAt.getTime())) {
    return NextResponse.json({
      error: "measured_at invalide",
      received_measured_at: measured_at,
    }, { status: 400 });
  }

  const w = parseFloat(String(weight));
  if (isNaN(w) || w <= 0) {
    return NextResponse.json({
      error: "weight invalide",
      received_weight: weight,
    }, { status: 400 });
  }

  const existing = await db
    .select({ id: weight_entries.id })
    .from(weight_entries)
    .where(eq(weight_entries.measured_at, measuredAt))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ success: true, inserted: false, message: "Déjà enregistré" });
  }

  await db.insert(weight_entries).values({
    measured_at: measuredAt,
    weight: String(w),
    source: "apple_health",
  });

  return NextResponse.json({ success: true, inserted: true, weight: w });
}
