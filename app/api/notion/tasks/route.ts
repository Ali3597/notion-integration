import { NextResponse } from "next/server";
import { notion, TASKS_DB } from "@/lib/notion";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  try {
    const filters: any[] = [
      {
        property: "Status",
        select: { does_not_equal: "Done" },
      },
    ];

    if (projectId) {
      filters.push({
        property: "Project",
        relation: { contains: projectId },
      });
    }

    const response = await notion.databases.query({
      database_id: TASKS_DB,
      filter: filters.length === 1 ? filters[0] : { and: filters },
      sorts: [{ property: "Name", direction: "ascending" }],
    });

    const tasks = response.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text ?? "Sans titre",
      status: page.properties.Status?.select?.name ?? null,
      priority: page.properties.Priority?.select?.name ?? null,
    }));

    return NextResponse.json(tasks);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur Notion" }, { status: 500 });
  }
}
