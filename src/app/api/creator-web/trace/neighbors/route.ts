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

function tsOf(row: any): number | null {
  if (!row) return null;
  if (typeof row.ts === "number") return row.ts;
  if (typeof row.created_at === "string") {
    const t = Date.parse(row.created_at);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

type Mini = {
  trace_id: string;
  provider_id: string;
  ts: number | null;
  action_type?: string;
  policy_verdict?: string;
  lifecycle?: string | null;
  runner_job_id?: string | null;
  runner_status?: string | null;
};

function mini(row: any): Mini {
  return {
    trace_id: String(row?.trace_id || row?.id || ""),
    provider_id: String(row?.provider_id || ""),
    ts: tsOf(row),
    action_type: row?.action_type ? String(row.action_type) : undefined,
    policy_verdict: row?.policy_verdict ? String(row.policy_verdict) : undefined,
    lifecycle: row?.meta?.lifecycle ? String(row.meta.lifecycle) : null,
    runner_job_id: row?.meta?.runner_job_id ? String(row.meta.runner_job_id) : null,
    runner_status: row?.meta?.runner_status ? String(row.meta.runner_status) : null,
  };
}

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const trace_id = String(searchParams.get("trace_id") || "").trim();
  const n = Math.max(1, Math.min(8, Number(searchParams.get("n") || 3)));
  const bytes = Math.max(
    64 * 1024,
    Math.min(2 * 1024 * 1024, Number(searchParams.get("bytes") || 256 * 1024))
  );
  const limit = Math.max(200, Math.min(5000, Number(searchParams.get("limit") || 2000)));
  if (!trace_id) {
    return NextResponse.json({ ok: false, error: "missing_trace_id" }, { status: 400 });
  }

  const file = traceFilePath();
  if (!fs.existsSync(file)) {
    return NextResponse.json({ ok: false, error: "trace_file_missing", file }, { status: 404 });
  }

  const raw = tailText(file, bytes);
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const rows: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    const obj = safeParse(lines[i]);
    if (!obj) continue;
    const tid = String(obj.trace_id || obj.id || "").trim();
    if (!tid) continue;
    rows.push(obj);
  }

  const trimmed = rows.slice(Math.max(0, rows.length - limit));

  // Find center
  let centerRow: any | null = null;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const tid = String(trimmed[i]?.trace_id || trimmed[i]?.id || "");
    if (tid === trace_id) {
      centerRow = trimmed[i];
      break;
    }
  }
  if (!centerRow) {
    return NextResponse.json({ ok: false, error: "center_trace_not_found_in_window" }, { status: 404 });
  }

  const center = mini(centerRow);
  const pid = center.provider_id;
  if (!pid) {
    return NextResponse.json({ ok: false, error: "center_provider_missing" }, { status: 500 });
  }

  // Collect same-provider rows
  const same: Mini[] = [];
  for (const r of trimmed) {
    if (String(r?.provider_id || "") !== pid) continue;
    const m = mini(r);
    if (!m.trace_id) continue;
    same.push(m);
  }

  // Sort by ts asc, tie-break by trace_id
  same.sort((a, b) => {
    const dt = (a.ts || 0) - (b.ts || 0);
    if (dt !== 0) return dt;
    return String(a.trace_id).localeCompare(String(b.trace_id));
  });

  const idx = same.findIndex((x) => x.trace_id === center.trace_id);
  if (idx < 0) {
    return NextResponse.json({ ok: false, error: "center_not_in_filtered_set" }, { status: 500 });
  }

  const prev = idx > 0 ? same[idx - 1] : null;
  const next = idx < same.length - 1 ? same[idx + 1] : null;
  const start = Math.max(0, idx - n);
  const end = Math.min(same.length, idx + n + 1);
  const timeline = same.slice(start, end);
  const center_index = idx - start;

  return NextResponse.json({
    ok: true,
    file,
    bytes_scanned: bytes,
    limit_rows: limit,
    n,
    center,
    prev,
    next,
    timeline,
    center_index,
    window: {
      provider_id: pid,
      total_same_provider: same.length,
    },
  });
}
