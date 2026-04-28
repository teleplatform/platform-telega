import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const route = url.searchParams.get("route") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const items = db.traces.list({ limit, route });
  return NextResponse.json({ items });
}
