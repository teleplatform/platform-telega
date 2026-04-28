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

function tsOrNow(row: any, fallbackNow: number): number {
  const t = tsOf(row);
  return t && t > 0 ? t : fallbackNow;
}
type SessionEvent = {
  trace_id: string;
  ts: number | null;
  action_type: string;
  verdict: string;
  lifecycle: string | null;
  runner_job_id: string | null;
  exit_code: any;
  meta: any;
};

type Session = {
  session_id: string;
  provider_id: string;
  started_at: number | null;
  ended_at: number | null;
  status: "open" | "ok" | "failed";
  reason: string | null;
  login_trace_id: string | null;
  health_ok_trace_id: string | null;
  events: SessionEvent[];
};

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const provider_id = String(searchParams.get("provider_id") || "").trim();
  const bytes = Math.max(
    64 * 1024,
    Math.min(2 * 1024 * 1024, Number(searchParams.get("bytes") || 256 * 1024))
  );
  const limit = Math.max(50, Math.min(2000, Number(searchParams.get("limit") || 800)));

  const file = traceFilePath();
  if (!fs.existsSync(file)) {
    return NextResponse.json({ ok: false, error: "trace_file_missing", file }, { status: 404 });
  }

  const raw = tailText(file, bytes);
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const rows = lines.map(safeParse).filter(Boolean);

  const filtered = rows.filter((r) => (provider_id ? String(r?.provider_id || "") === provider_id : true));
  const recent = filtered.slice(-limit);

  const sessions: Session[] = [];
  const orphans: SessionEvent[] = [];
  const openByProvider = new Map<string, Session>();
  const now = Date.now();

  function pushEvent(s: Session, row: any) {
    const ev: SessionEvent = {
      trace_id: String(row.trace_id || row.id || ""),
      ts: tsOrNow(row, now),
      action_type: String(row.action_type || ""),
      verdict: String(row.policy_verdict || ""),
      lifecycle: row?.meta?.lifecycle ? String(row.meta.lifecycle) : null,
      runner_job_id: row?.meta?.runner_job_id ? String(row.meta.runner_job_id) : null,
      exit_code: row?.meta?.exit_code ?? null,
      meta: row?.meta || null,
    };
    s.events.push(ev);
    if (s.events.length > 400) s.events = s.events.slice(s.events.length - 400);
  }

  function makeSessionId(provider: string, startedAt: number | null, runnerJobId: string | null) {
    const ts = startedAt ?? Date.now();
    const job = runnerJobId ? runnerJobId.slice(0, 10) : "nojob";
    return `${provider}:${ts}:${job}`;
  }

  function openSession(provider: string, row: any): Session {
    const evTs = tsOf(row);
    const runnerJobId = row?.meta?.runner_job_id ? String(row.meta.runner_job_id) : null;
    const sid = makeSessionId(provider, evTs, runnerJobId);
    const s: Session = {
      session_id: sid,
      provider_id: provider,
      started_at: evTs,
      ended_at: null,
      status: "open",
      reason: null,
      login_trace_id: String(row.trace_id || row.id || ""),
      health_ok_trace_id: null,
      events: [],
    };
    pushEvent(s, row);
    openByProvider.set(provider, s);
    return s;
  }

  function closeSession(s: Session) {
    sessions.push(s);
    openByProvider.delete(s.provider_id);
  }

  for (const row of recent) {
    const provider = String(row?.provider_id || "");
    if (!provider) continue;
    const act = String(row?.action_type || "");
    const verdict = String(row?.policy_verdict || "");
    const life = row?.meta?.lifecycle ? String(row.meta.lifecycle) : "";
    const runner_job_id = row?.meta?.runner_job_id ? String(row.meta.runner_job_id) : "";
    const t = tsOrNow(row, now);

    const isLogin = act === "login" || (life === "runner_job_started" && row?.meta?.runner_action === "web:login");
    const isHealthOk = act === "health" && verdict === "allowed";
    const isFail =
      verdict === "blocked" ||
      (life === "runner_job_finished" && String(row?.meta?.runner_status || "") === "failed");

    let s = openByProvider.get(provider);

    if (isLogin) {
      if (s) closeSession(s);
      s = openSession(provider, row);
      continue;
    }

    if (!s) {
      orphans.push({
        trace_id: String(row.trace_id || row.id || ""),
        ts: t,
        action_type: act,
        verdict,
        lifecycle: life || null,
        runner_job_id: runner_job_id || null,
        exit_code: row?.meta?.exit_code ?? null,
        meta: row?.meta || null,
      });
      continue;
    }

    pushEvent(s, row);

    if (isHealthOk) {
      s.status = "ok";
      s.health_ok_trace_id = String(row.trace_id || row.id || "");
      s.ended_at = t || Date.now();
      closeSession(s);
      continue;
    }

    if (isFail) {
      s.status = "failed";
      s.reason =
        String(row?.meta?.runner_status || "") === "failed"
          ? "runner_failed"
          : verdict === "blocked"
          ? "policy_blocked"
          : "failed";
      s.ended_at = t || Date.now();
      closeSession(s);
      continue;
    }
  }

  const openSessions = Array.from(openByProvider.values());
  for (const s of openSessions) {
    if (s.events.length > 200) s.events = s.events.slice(s.events.length - 200);
  }

  sessions.sort((a, b) => (b.started_at || 0) - (a.started_at || 0));
  openSessions.sort((a, b) => (b.started_at || 0) - (a.started_at || 0));

  return NextResponse.json({
    ok: true,
    file,
    provider_id: provider_id || null,
    bytes_scanned: bytes,
    limit_rows: limit,
    sessions,
    open_sessions: openSessions,
    orphans: orphans.slice(Math.max(0, orphans.length - 120)),
  });
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
