import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `upload-${Date.now()}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "dnd");
    const filePath = join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({ url: `/uploads/dnd/${filename}` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur upload" }, { status: 500 });
  }
}
