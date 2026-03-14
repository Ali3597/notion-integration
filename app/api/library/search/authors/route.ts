import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (!q?.trim()) return NextResponse.json([]);

  try {
    const url = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}&limit=6`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json([]);

    const data = await res.json();
    const results = (data.docs ?? []).map((doc: Record<string, unknown>) => ({
      name: doc.name as string,
      photo_url: doc.key
        ? `https://covers.openlibrary.org/a/olid/${doc.key}-M.jpg`
        : null,
      birth_year: (doc.birth_date as string | undefined) ?? null,
      top_subjects: ((doc.top_subjects as string[] | undefined) ?? []).slice(0, 3),
    }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
