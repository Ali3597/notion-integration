import { NextResponse } from "next/server";
import { notion, PROJECTS_DB } from "@/lib/notion";

export async function GET() {
  try {
    const response = await notion.databases.query({
      database_id: PROJECTS_DB,
      sorts: [{ property: "Name", direction: "ascending" }],
    });

    const projects = response.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text ?? "Sans titre",
      status: page.properties.Status?.select?.name ?? null,
      type: page.properties.Type?.select?.name ?? null,
    }));

    return NextResponse.json(projects);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur Notion" }, { status: 500 });
  }
}
