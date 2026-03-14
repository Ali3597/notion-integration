import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (!q?.trim()) return NextResponse.json([]);

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,cover_i,subject,first_publish_year`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json([]);

    const data = await res.json();
    const results = (data.docs ?? []).map((doc: Record<string, unknown>) => ({
      title: doc.title as string,
      authors: (doc.author_name as string[] | undefined) ?? [],
      cover_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      year: (doc.first_publish_year as number | undefined) ?? null,
      subjects: ((doc.subject as string[] | undefined) ?? []).slice(0, 5),
    }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
