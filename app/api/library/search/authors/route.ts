import { NextResponse } from "next/server";

type AuthorResult = {
  name: string;
  photo_url: string | null;
  birth_year: string | null;
  top_subjects: string[];
};

async function searchOpenLibraryAuthor(q: string): Promise<AuthorResult[]> {
  const url = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}&limit=8`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as { docs?: Record<string, unknown>[] };
  return (data.docs ?? []).map((doc) => {
    // key is "/authors/OL123A" — extract just the OLID part
    const key = (doc.key as string | undefined) ?? "";
    const olid = key.replace(/^\/authors\//, "");
    return {
      name: (doc.name as string) ?? q,
      photo_url: olid ? `https://covers.openlibrary.org/a/olid/${olid}-M.jpg` : null,
      birth_year: (doc.birth_date as string | undefined)?.slice(0, 4) ?? null,
      top_subjects: ((doc.top_subjects as string[] | undefined) ?? []).slice(0, 3),
    };
  });
}

async function searchWikipediaAuthor(q: string, lang = "fr"): Promise<AuthorResult[]> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(q)}&gsrlimit=6&prop=pageimages|pageterms` +
    `&format=json&pithumbsize=300`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    query?: { pages?: Record<string, Record<string, unknown>> };
  };
  const pages = Object.values(data.query?.pages ?? {});

  return pages
    .filter((p) => p.thumbnail)
    .map((p) => {
      const thumb = (p.thumbnail as { source?: string }).source ?? null;
      return {
        name: (p.title as string) ?? q,
        photo_url: thumb,
        birth_year: null,
        top_subjects: [],
      };
    });
}

async function searchBnFAuthor(q: string): Promise<AuthorResult[]> {
  const escaped = q.replace(/["\\]/g, " ").trim();
  const sparql = `
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX bio: <http://vocab.org/bio/0.1/>
SELECT DISTINCT ?name ?depiction ?birthDate WHERE {
  ?person a foaf:Person .
  ?person foaf:name ?name .
  OPTIONAL { ?person foaf:depiction ?depiction }
  OPTIONAL { ?person bio:birth ?birthDate }
  FILTER(regex(lcase(str(?name)), lcase("${escaped}"), "i"))
} LIMIT 6`.trim();

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
      const depiction = row.depiction?.value ?? null;
      const photo_url =
        depiction && depiction.startsWith("http")
          ? depiction.replace(/^http:\/\//, "https://")
          : null;
      const birthRaw = row.birthDate?.value ?? null;
      return {
        name: row.name?.value ?? q,
        photo_url,
        birth_year: birthRaw ? birthRaw.slice(0, 4) : null,
        top_subjects: [],
      } satisfies AuthorResult;
    })
    .filter((a) => a.name);
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (!q?.trim()) return NextResponse.json([]);

  // Run Open Library + Wikipedia (fr + en) in parallel
  const [olResults, wikifrResults, wikienResults] = await Promise.allSettled([
    searchOpenLibraryAuthor(q),
    searchWikipediaAuthor(q, "fr"),
    searchWikipediaAuthor(q, "en"),
  ]);

  const ol = olResults.status === "fulfilled" ? olResults.value : [];
  const wikifr = wikifrResults.status === "fulfilled" ? wikifrResults.value : [];
  const wikien = wikienResults.status === "fulfilled" ? wikienResults.value : [];

  // Merge: Wikipedia first (best photos), then Open Library
  const merged: AuthorResult[] = [];
  const seen = new Set<string>();

  function addResult(r: AuthorResult) {
    const key = r.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(r);
    }
  }

  for (const r of wikifr) addResult(r);
  for (const r of wikien) addResult(r);
  for (const r of ol) addResult(r);

  // If we have results with photos, return them
  const withPhotos = merged.filter((r) => r.photo_url);
  if (withPhotos.length > 0) {
    return NextResponse.json(merged.slice(0, 8));
  }

  // BnF fallback — better for French author names/metadata, photos are rarer
  try {
    const bnf = await searchBnFAuthor(q);
    // Augment BnF entries that have no photo with Open Library photos
    for (const b of bnf) {
      if (!b.photo_url) {
        const olMatch = ol.find(
          (o) =>
            o.photo_url &&
            o.name.toLowerCase().includes(b.name.toLowerCase().split(" ")[0]),
        );
        if (olMatch) b.photo_url = olMatch.photo_url;
      }
    }
    const all = [...bnf, ...merged.filter((r) => !seen.has(r.name.toLowerCase().trim()))];
    return NextResponse.json(all.slice(0, 8));
  } catch {
    return NextResponse.json(merged.slice(0, 8));
  }
}
