import { NextResponse } from "next/server";
import { getMetrics, getSessionsLast3Months } from "@/lib/petitbambou";

export async function GET() {
  try {
    const [metrics, allRecent] = await Promise.all([
      getMetrics(),
      getSessionsLast3Months(),
    ]);

    const recentSessions = [...allRecent]
      .sort((a, b) => Number(b.activity_time) - Number(a.activity_time))
      .slice(0, 10);

    return NextResponse.json({
      metrics,
      recentSessions,
      dbConfigured: !!process.env.NOTION_MEDITATIONS_DB,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[petitbambou/stats]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
