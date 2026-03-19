import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { weight_entries } from "@/lib/schema";
import { desc } from "drizzle-orm";

function n(v: string | null | undefined): number | null {
  if (!v) return null;
  const x = parseFloat(v);
  return isNaN(x) ? null : x;
}

function linearSlope(points: { x: number; y: number }[]): number {
  const count = points.length;
  if (count < 2) return 0;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = count * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (count * sumXY - sumX * sumY) / denom;
}

export async function GET() {
  try {
    const all = await db
      .select()
      .from(weight_entries)
      .orderBy(desc(weight_entries.measured_at));

    if (all.length === 0) {
      return NextResponse.json({ last: null, total: 0, stats: null, history: [], periods: {} });
    }

    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const d180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const last = all[0];
    const first = all[all.length - 1];

    const entries30 = all.filter((e) => e.measured_at >= d30);
    const entries90 = all.filter((e) => e.measured_at >= d90);

    function rangeStats(arr: typeof all) {
      if (!arr.length) return null;
      const ws = arr.map((e) => n(e.weight)!);
      return {
        min: Math.min(...ws),
        max: Math.max(...ws),
        avg: ws.reduce((a, b) => a + b, 0) / ws.length,
        count: ws.length,
      };
    }

    // 30d trend slope (kg/day)
    const trend30Points = entries30.map((e) => ({
      x: e.measured_at.getTime() / (1000 * 60 * 60 * 24),
      y: n(e.weight)!,
    }));
    const slope30 = linearSlope(trend30Points);

    // 7d variation — find closest entry before 7 days ago
    const closest7d = all.find((e) => e.measured_at <= d7);
    const variation7d =
      closest7d !== undefined ? Math.round((n(last.weight)! - n(closest7d.weight)!) * 10) / 10 : null;

    // History (chronological)
    const history = [...all]
      .reverse()
      .map((e) => ({ date: e.measured_at.toISOString(), weight: n(e.weight)! }));

    return NextResponse.json({
      last: { weight: n(last.weight), measured_at: last.measured_at, id: last.id },
      total: all.length,
      stats: {
        all: rangeStats(all),
        "30d": rangeStats(entries30),
        "90d": rangeStats(entries90),
        variation_total:
          first && last ? Math.round((n(last.weight)! - n(first.weight)!) * 10) / 10 : null,
        variation_7d: variation7d,
        slope_30d: slope30,
      },
      history,
      periods: {
        "30d": d30.toISOString().split("T")[0],
        "90d": d90.toISOString().split("T")[0],
        "6m": d180.toISOString().split("T")[0],
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
