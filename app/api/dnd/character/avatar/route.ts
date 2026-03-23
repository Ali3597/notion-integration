import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { dnd_character } from "@/lib/schema";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `avatar-${Date.now()}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "dnd");
    const filePath = join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/dnd/${filename}`;

    // Update character avatar_url in DB
    const rows = await db.select({ id: dnd_character.id }).from(dnd_character).limit(1);
    if (rows.length > 0) {
      await db.update(dnd_character).set({ avatar_url: publicUrl }).where(sql`id = ${rows[0].id}`);
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur upload" }, { status: 500 });
  }
}
