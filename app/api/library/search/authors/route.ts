import { NextResponse } from "next/server";

type AuthorResult = {
  name: string;
  photo_url: string | null;
  birth_year: string | null;
  top_subjects: string[];
};

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

async function searchOpenLibraryAuthor(q: string): Promise<AuthorResult[]> {
  const url = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}&limit=6`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as { docs?: Record<string, unknown>[] };
  return (data.docs ?? []).map((doc) => ({
    name: (doc.name as string) ?? q,
    photo_url: doc.key
      ? `https://covers.openlibrary.org/a/olid/${doc.key}-M.jpg`
      : null,
    birth_year: (doc.birth_date as string | undefined)?.slice(0, 4) ?? null,
    top_subjects: ((doc.top_subjects as string[] | undefined) ?? []).slice(0, 3),
  }));
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (!q?.trim()) return NextResponse.json([]);

  // BnF first — best source for French/Francophone authors
  try {
    const bnf = await searchBnFAuthor(q);
    if (bnf.length > 0) {
      // If BnF has results but none have a photo, augment with Open Library photos
      const hasPhoto = bnf.some((a) => a.photo_url);
      if (!hasPhoto) {
        try {
          const ol = await searchOpenLibraryAuthor(q);
          // Merge photos: match by name similarity
          for (const b of bnf) {
            const olMatch = ol.find(
              (o) =>
                o.photo_url &&
                o.name.toLowerCase().includes(b.name.toLowerCase().split(" ")[0]),
            );
            if (olMatch) b.photo_url = olMatch.photo_url;
          }
        } catch {
          // Photo enrichment failed — return BnF results without photos
        }
      }
      return NextResponse.json(bnf);
    }
  } catch {
    // BnF unavailable — fall through to Open Library
  }

  // Open Library fallback
  try {
    const ol = await searchOpenLibraryAuthor(q);
    return NextResponse.json(ol);
  } catch {
    return NextResponse.json([]);
  }
}
