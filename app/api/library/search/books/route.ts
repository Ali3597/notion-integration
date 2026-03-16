import { NextResponse } from "next/server";

type BookResult = {
  title: string;
  authors: string[];
  cover_url: string | null;
  year: string | null;
  subjects: string[];
  description: string | null;
};

// Strip leading French articles to improve intitle: search accuracy
function cleanTitle(q: string): string {
  return q.replace(/^(les?\s|la\s|l[''\u2019]|une?\s|des?\s)/i, "").trim();
}

function normalizeGoogleItem(item: Record<string, unknown>): BookResult {
  const info = (item.volumeInfo ?? {}) as Record<string, unknown>;
  const imageLinks = (info.imageLinks ?? {}) as Record<string, string>;
  let cover_url: string | null = imageLinks.thumbnail ?? imageLinks.smallThumbnail ?? null;
  if (cover_url) {
    cover_url = cover_url
      .replace(/^http:\/\//, "https://")
      .replace(/&edge=curl/g, "")
      .replace(/zoom=\d/, "zoom=1");
  }
  const publishedDate = (info.publishedDate as string | undefined) ?? null;
  return {
    title: (info.title as string) ?? "",
    authors: (info.authors as string[] | undefined) ?? [],
    cover_url,
    year: publishedDate ? publishedDate.slice(0, 4) : null,
    subjects: ((info.categories as string[] | undefined) ?? []).slice(0, 5),
    description: info.description
      ? (info.description as string).slice(0, 100)
      : null,
  };
}

async function googleBooks(
  q: string,
  author: string,
  langRestrict: boolean,
  apiKey: string,
): Promise<BookResult[]> {
  const cleaned = cleanTitle(q);
  let queryParam = langRestrict
    ? `intitle:${encodeURIComponent(cleaned)}`
    : encodeURIComponent(q);
  if (author.trim()) queryParam += `+inauthor:${encodeURIComponent(author.trim())}`;
  let url = `https://www.googleapis.com/books/v1/volumes?q=${queryParam}&maxResults=10&key=${apiKey}`;
  if (langRestrict) url += "&langRestrict=fr";

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: Record<string, unknown>[] };
  return (data.items ?? []).map(normalizeGoogleItem).filter((b) => b.title);
}

async function openLibraryBooks(q: string, author = ""): Promise<BookResult[]> {
  let url =
    `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}` +
    `&limit=10&fields=title,author_name,cover_i,first_publish_year,subject`;
  if (author.trim()) url += `&author=${encodeURIComponent(author.trim())}`;
  url += "&language=fre";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as { docs?: Record<string, unknown>[] };
  return (data.docs ?? [])
    .map((doc) => ({
      title: (doc.title as string) ?? "",
      authors: (doc.author_name as string[] | undefined) ?? [],
      cover_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      year: doc.first_publish_year ? String(doc.first_publish_year) : null,
      subjects: ((doc.subject as string[] | undefined) ?? []).slice(0, 5),
      description: null,
    }))
    .filter((b) => b.title);
}

async function bnfBookFallback(q: string): Promise<BookResult[]> {
  const escaped = q.replace(/["\\]/g, " ").trim();
  const sparql = `
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX bnf-onto: <http://data.bnf.fr/ontology/bnf-onto/>
SELECT DISTINCT ?ark ?title WHERE {
  ?doc dcterms:title ?title .
  ?doc bnf-onto:ark ?ark .
  FILTER(regex(lcase(str(?title)), lcase("${escaped}"), "i"))
} LIMIT 5`.trim();

  const url = `https://data.bnf.fr/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    results: {
      bindings: Array<Record<string, { type: string; value: string }>>;
    };
  };

  return (data.results?.bindings ?? [])
    .map((row) => {
      const arkUri = row.ark?.value ?? "";
      const title = row.title?.value ?? "";
      const arkMatch = arkUri.match(/(ark:\/12148\/[^/#\s]+)/);
      const cover_url = arkMatch
        ? `https://catalogue.bnf.fr/couverture?appName=NE&idArk=${encodeURIComponent(arkMatch[1])}&couverture=1`
        : null;
      return {
        title,
        authors: [],
        cover_url,
        year: null,
        subjects: [],
        description: null,
      } satisfies BookResult;
    })
    .filter((b) => b.title);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q");
  const author = params.get("author") ?? "";
  if (!q?.trim()) return NextResponse.json([]);

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Clé Google Books manquante" },
      { status: 503 },
    );
  }

  try {
    // Run Google Books (fr) + Open Library in parallel
    const [frResults, olResults] = await Promise.allSettled([
      googleBooks(q, author, true, apiKey),
      openLibraryBooks(q, author),
    ]);

    let results = frResults.status === "fulfilled" ? frResults.value : [];
    const ol = olResults.status === "fulfilled" ? olResults.value : [];

    // If fewer than 3 Google results, broaden to all languages
    if (results.length < 3) {
      try {
        const broader = await googleBooks(q, author, false, apiKey);
        const seen = new Set(results.map((r) => r.title.toLowerCase()));
        for (const b of broader) {
          if (!seen.has(b.title.toLowerCase())) {
            results.push(b);
            seen.add(b.title.toLowerCase());
          }
          if (results.length >= 10) break;
        }
      } catch {
        // non-fatal
      }
    }

    // Augment Google Books results with Open Library covers
    for (const r of results) {
      if (!r.cover_url) {
        const olMatch = ol.find(
          (o) =>
            o.cover_url &&
            o.title.toLowerCase().slice(0, 10) === r.title.toLowerCase().slice(0, 10),
        );
        if (olMatch) r.cover_url = olMatch.cover_url;
      }
    }

    // Add unique Open Library results (with covers) not already in Google results
    const seenTitles = new Set(results.map((r) => r.title.toLowerCase().slice(0, 12)));
    for (const o of ol) {
      if (o.cover_url && !seenTitles.has(o.title.toLowerCase().slice(0, 12))) {
        results.push(o);
        seenTitles.add(o.title.toLowerCase().slice(0, 12));
      }
      if (results.length >= 12) break;
    }

    // BnF fallback when no result has a cover image
    if (results.length > 0 && !results.some((r) => r.cover_url)) {
      try {
        const bnf = await bnfBookFallback(q);
        for (const bf of bnf) {
          const match = results.find((r) =>
            r.title.toLowerCase().startsWith(bf.title.toLowerCase().slice(0, 8)),
          );
          if (match && !match.cover_url) {
            match.cover_url = bf.cover_url;
          } else if (!match && bf.cover_url) {
            results.push(bf);
          }
        }
      } catch {
        // non-fatal
      }
    }

    // If Google + OL found nothing, try BnF directly
    if (results.length === 0) {
      try {
        results = await bnfBookFallback(q);
      } catch {
        return NextResponse.json([]);
      }
    }

    return NextResponse.json(results.slice(0, 10));
  } catch {
    return NextResponse.json([]);
  }
}
