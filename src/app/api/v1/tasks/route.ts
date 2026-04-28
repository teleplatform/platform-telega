import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const visibility = url.searchParams.get("visibility") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const items = db.tasks.list({ status: status || undefined, visibility: visibility || undefined, limit });

  const withArtifacts = items.map((t) => {
    const artifacts = db.taskArtifacts.list(t.task_id);
    return {
      ...t,
      artifacts_count: artifacts.length,
    };
  });

  return NextResponse.json({ ok: true, items: withArtifacts });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const res = db.tasks.create({
    title: typeof body?.title === "string" ? body.title : undefined,
    visibility: body?.visibility,
    task_json: typeof body?.task_json === "string" ? body.task_json : undefined,
  });

  return NextResponse.json({ id: res.id });
}
