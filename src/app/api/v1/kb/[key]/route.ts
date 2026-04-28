import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET(_: Request, ctx: { params: { key: string } }) {
  const key = ctx.params.key;
  const entry = db.kb.get(key);
  if (!entry) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    key,
    source: "db",
    payload_json: safeParse(entry.payload_json),
    version: entry.version,
    etag: entry.etag,
  });
}

export async function PUT(req: Request, ctx: { params: { key: string } }) {
  const key = ctx.params.key;
  const body = await req.json().catch(() => ({}));
  const payload = body?.payload_json;
  const headerEtag = req.headers.get("if-match") ?? undefined;
  const ifMatch = typeof body?.if_match_etag === "string" ? body.if_match_etag : headerEtag;

  if (payload === undefined) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const payload_json = typeof payload === "string" ? payload : JSON.stringify(payload);
  const res = db.kb.putCAS({ key, payload_json, if_match_etag: ifMatch });

  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "etag_conflict",
        current_etag: res.current?.etag ?? null,
        current_version: res.current?.version ?? null,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    key,
    source: "db",
    payload_json: safeParse(res.entry.payload_json),
    version: res.entry.version,
    etag: res.entry.etag,
  });
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
