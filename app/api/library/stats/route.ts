import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, authors, genres, series } from "@/lib/schema";
import { eq, and, isNotNull, inArray, sql } from "drizzle-orm";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const today = new Date();
    const todayStr = localDateStr(today);

    const d12m = new Date(today.getFullYear(), today.getMonth() - 12, 1);
    const twelveMonthsAgo = localDateStr(d12m);

    const d2y = new Date(today.getFullYear() - 2, today.getMonth(), 1);
    const twoYearsAgo = localDateStr(d2y);

    const [
      statusCountRows,
      readingBooksRaw,
      bestSerieRow,
      finishedByMonthRows,
      genreDistRows,
      speedByGenreRows,
      ratingByQuarterRows,
      topAuthorsRows,
      backlogByGenreRows,
      startedByMonthRows,
    ] = await Promise.all([
      // Status counts
      db
        .select({ status: books.status, count: sql<number>`count(*)` })
        .from(books)
        .groupBy(books.status),

      // Books with start + finish (heatmap + avg speed)
      db
        .select({ started_at: books.started_at, finished_at: books.finished_at })
        .from(books)
        .where(and(isNotNull(books.started_at), isNotNull(books.finished_at))),

      // Best serie by books "Lu"
      db
        .select({ name: series.name, count: sql<number>`count(*)` })
        .from(books)
        .leftJoin(series, eq(books.serie_id, series.id))
        .where(and(eq(books.status, "Lu"), isNotNull(books.serie_id)))
        .groupBy(series.id, series.name)
        .orderBy(sql`count(*) DESC`)
        .limit(1),

      // Finished per month — last 12 months
      db
        .select({
          month: sql<string>`to_char(finished_at, 'YYYY-MM')`,
          count: sql<number>`count(*)`,
        })
        .from(books)
        .where(and(isNotNull(books.finished_at), sql`finished_at >= ${twelveMonthsAgo}::date`))
        .groupBy(sql`to_char(finished_at, 'YYYY-MM')`)
        .orderBy(sql`to_char(finished_at, 'YYYY-MM')`),

      // Genre distribution (Lu)
      db
        .select({ name: genres.name, icon: genres.icon, count: sql<number>`count(*)` })
        .from(books)
        .leftJoin(genres, eq(books.genre_id, genres.id))
        .where(eq(books.status, "Lu"))
        .groupBy(genres.id, genres.name, genres.icon)
        .orderBy(sql`count(*) DESC`),

      // Reading speed by genre
      db
        .select({
          name: genres.name,
          icon: genres.icon,
          avg_days: sql<number>`round(avg(finished_at - started_at)::numeric)`,
        })
        .from(books)
        .leftJoin(genres, eq(books.genre_id, genres.id))
        .where(and(isNotNull(books.started_at), isNotNull(books.finished_at)))
        .groupBy(genres.id, genres.name, genres.icon)
        .orderBy(sql`round(avg(finished_at - started_at)::numeric) ASC`),

      // Rating by quarter — last 2 years
      db
        .select({
          quarter: sql<string>`to_char(date_trunc('quarter', finished_at::timestamp), 'YYYY-"Q"Q')`,
          avg_rating: sql<number>`round(avg(rating::numeric), 1)`,
          count: sql<number>`count(*)`,
        })
        .from(books)
        .where(
          and(
            isNotNull(books.rating),
            isNotNull(books.finished_at),
            sql`finished_at >= ${twoYearsAgo}::date`,
          ),
        )
        .groupBy(sql`date_trunc('quarter', finished_at::timestamp)`)
        .orderBy(sql`date_trunc('quarter', finished_at::timestamp)`),

      // Top 8 authors
      db
        .select({
          name: authors.name,
          book_count: sql<number>`count(*)`,
          avg_rating: sql<number>`round(avg(books.rating::numeric), 1)`,
        })
        .from(books)
        .leftJoin(authors, eq(books.author_id, authors.id))
        .where(eq(books.status, "Lu"))
        .groupBy(authors.id, authors.name)
        .orderBy(sql`count(*) DESC`)
        .limit(8),

      // Backlog by genre (Souhait + Pas Lu), split by status
      db
        .select({
          name: genres.name,
          icon: genres.icon,
          souhait: sql<number>`count(*) filter (where books.status = 'Souhait')`,
          pas_lu: sql<number>`count(*) filter (where books.status = 'Pas Lu')`,
        })
        .from(books)
        .leftJoin(genres, eq(books.genre_id, genres.id))
        .where(inArray(books.status, ["Souhait", "Pas Lu"]))
        .groupBy(genres.id, genres.name, genres.icon)
        .orderBy(sql`count(*) DESC`),

      // Started per month — last 12 months
      db
        .select({
          month: sql<string>`to_char(started_at, 'YYYY-MM')`,
          count: sql<number>`count(*)`,
        })
        .from(books)
        .where(and(isNotNull(books.started_at), sql`started_at >= ${twelveMonthsAgo}::date`))
        .groupBy(sql`to_char(started_at, 'YYYY-MM')`)
        .orderBy(sql`to_char(started_at, 'YYYY-MM')`),
    ]);

    // ── KPIs ────────────────────────────────────────────────────────────────

    const statusMap = new Map(statusCountRows.map((r) => [r.status, Number(r.count)]));
    const totalLu = statusMap.get("Lu") ?? 0;

    // Avg reading speed (JS-side from raw book dates)
    let avgSpeedDays: number | null = null;
    if (readingBooksRaw.length > 0) {
      const totalDays = readingBooksRaw.reduce((sum, b) => {
        const diff = Math.round(
          (new Date(b.finished_at!).getTime() - new Date(b.started_at!).getTime()) / 86400000,
        );
        return sum + Math.max(0, diff);
      }, 0);
      avgSpeedDays = Math.round(totalDays / readingBooksRaw.length);
    }

    const totalFinished12m = finishedByMonthRows.reduce((s, r) => s + Number(r.count), 0);
    const avgMonthlyRhythm = Math.round((totalFinished12m / 12) * 10) / 10;

    // ── Heatmap (365 days) ──────────────────────────────────────────────────

    const heatmap: { date: string; count: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = localDateStr(d);
      const count = readingBooksRaw.filter(
        (b) => b.started_at! <= dateStr && b.finished_at! >= dateStr,
      ).length;
      heatmap.push({ date: dateStr, count });
    }

    // ── 12-month time series ────────────────────────────────────────────────

    const months12: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months12.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const finishedMap = new Map(finishedByMonthRows.map((r) => [r.month, Number(r.count)]));
    const startedMap = new Map(startedByMonthRows.map((r) => [r.month, Number(r.count)]));

    return NextResponse.json({
      kpis: {
        total_lu: totalLu,
        total_en_cours: statusMap.get("En cours") ?? 0,
        total_souhait: statusMap.get("Souhait") ?? 0,
        total_pas_lu: statusMap.get("Pas Lu") ?? 0,
        avg_monthly_rhythm: avgMonthlyRhythm,
        avg_speed_days: avgSpeedDays,
        best_serie: bestSerieRow[0]
          ? { name: bestSerieRow[0].name ?? "—", count: Number(bestSerieRow[0].count) }
          : null,
      },
      heatmap,
      finishedByMonth: months12.map((month) => ({ month, count: finishedMap.get(month) ?? 0 })),
      genreDistribution: genreDistRows.map((r) => ({
        name: r.name ?? "Sans genre",
        icon: r.icon ?? "",
        count: Number(r.count),
      })),
      speedByGenre: speedByGenreRows
        .filter((r) => r.avg_days != null)
        .map((r) => ({
          name: (r.icon ? r.icon + " " : "") + (r.name ?? "Sans genre"),
          avg_days: Number(r.avg_days),
        })),
      ratingByQuarter: ratingByQuarterRows.map((r) => ({
        quarter: r.quarter,
        avg_rating: Number(r.avg_rating),
        count: Number(r.count),
      })),
      topAuthors: topAuthorsRows.map((r) => ({
        name: r.name ?? "Inconnu",
        book_count: Number(r.book_count),
        avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null,
      })),
      backlogByGenre: backlogByGenreRows.map((r) => ({
        name: (r.icon ? r.icon + " " : "") + (r.name ?? "Sans genre"),
        souhait: Number(r.souhait),
        pas_lu: Number(r.pas_lu),
      })),
      startedVsFinished: months12.map((month) => ({
        month,
        started: startedMap.get(month) ?? 0,
        finished: finishedMap.get(month) ?? 0,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}
