import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET(_: Request, ctx: { params: { artifact_id: string } }) {
  const artifact = db.taskArtifacts.get(ctx.params.artifact_id);
  if (!artifact) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  try {
    const file = await fs.readFile(artifact.path);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": artifact.mime,
        "Content-Length": String(artifact.bytes),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "file_missing" }, { status: 404 });
  }
}
