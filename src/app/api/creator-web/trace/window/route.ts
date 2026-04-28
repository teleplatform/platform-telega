import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getAuthContext } from "../../../_auth";
import { isMaker } from "../../../_guard";

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

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const trace_id = String(searchParams.get("trace_id") || "").trim();
  const n = Math.max(5, Math.min(200, Number(searchParams.get("n") || 40)));
  if (!trace_id) {
    return NextResponse.json({ ok: false, error: "missing_trace_id" }, { status: 400 });
  }

  const file = traceFilePath();
  if (!fs.existsSync(file)) {
    return NextResponse.json({ ok: false, error: "trace_file_missing", file }, { status: 404 });
  }

  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const rows = lines
    .map((ln, idx) => ({ idx, obj: safeParse(ln), raw: ln }))
    .filter((x) => x.obj && String(x.obj.trace_id || x.obj.id || ""));

  const idx = rows.findIndex((x) => String(x.obj.trace_id || x.obj.id || "") === trace_id);

  if (idx < 0) {
    return NextResponse.json({ ok: false, error: "trace_not_found" }, { status: 404 });
  }

  const center = rows[idx].obj;
  const start = Math.max(0, idx - n);
  const end = Math.min(rows.length - 1, idx + n);
  const windowRows = rows.slice(start, end + 1).map((x) => x.obj);

  const runner_job_id = String(center?.meta?.runner_job_id || "").trim();
  const chain = runner_job_id
    ? rows.map((x) => x.obj).filter((o) => String(o?.meta?.runner_job_id || "") === runner_job_id)
    : [];

  return NextResponse.json({
    ok: true,
    trace_id,
    file,
    center,
    window: {
      n,
      start_index: start,
      end_index: end,
      rows: windowRows,
    },
    chain: {
      runner_job_id: runner_job_id || null,
      rows: chain,
    },
  });
}
