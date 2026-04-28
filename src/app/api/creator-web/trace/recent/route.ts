import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getAuthContext } from "../../../../_auth";
import { isMaker } from "../../../../_guard";

export const runtime = "nodejs";

function traceFilePath(): string {
  return (
    process.env.TELEGPT_CREATOR_WEB_TRACE_PATH ||
    process.env.TELEGPT_CREATOR_WEB_TRACE_FILE ||
    path.join(process.cwd(), ".telegpt", "creator-web-trace.jsonl")
  );
}

function safeParse(line: string): any | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function tailText(file: string, maxBytes: number): string {
  const st = fs.statSync(file);
  const start = Math.max(0, st.size - maxBytes);
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(st.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.max(10, Math.min(500, Number(searchParams.get("limit") || 120)));
  const bytes = Math.max(
    64 * 1024,
    Math.min(2 * 1024 * 1024, Number(searchParams.get("bytes") || 256 * 1024))
  );

  const provider_id = String(searchParams.get("provider_id") || "").trim();
  const action_type = String(searchParams.get("action_type") || "").trim();
  const verdict = String(searchParams.get("policy_verdict") || "").trim();
  const runner_job_id = String(searchParams.get("runner_job_id") || "").trim();
  const lifecycle = String(searchParams.get("lifecycle") || "").trim();

  const file = traceFilePath();
  if (!fs.existsSync(file)) {
    return NextResponse.json({ ok: false, error: "trace_file_missing", file }, { status: 404 });
  }

  const raw = tailText(file, bytes);
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const out: any[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const obj = safeParse(lines[i]);
    if (!obj) continue;

    if (provider_id && String(obj.provider_id || "") !== provider_id) continue;
    if (action_type && String(obj.action_type || "") !== action_type) continue;
    if (verdict && String(obj.policy_verdict || "") !== verdict) continue;

    const mj = String(obj?.meta?.runner_job_id || "");
    const ml = String(obj?.meta?.lifecycle || "");
    if (runner_job_id && mj !== runner_job_id) continue;
    if (lifecycle && ml !== lifecycle) continue;

    out.push(obj);
    if (out.length >= limit) break;
  }

  return NextResponse.json({
    ok: true,
    file,
    limit,
    bytes_scanned: bytes,
    items: out,
  });
}
