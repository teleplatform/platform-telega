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

type Sess = {
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

function makeSessionId(provider: string, startedAt: number | null, runnerJobId: string | null) {
  const ts = startedAt ?? Date.now();
  const job = runnerJobId ? runnerJobId.slice(0, 10) : "nojob";
  return `${provider}:${ts}:${job}`;
}

function buildSessions(rows: any[], fallbackNow: number): Sess[] {
  const sessions: Sess[] = [];
  const openByProvider = new Map<string, Sess>();

  function pushEvent(s: Sess, row: any) {
    const ev: SessionEvent = {
      trace_id: String(row.trace_id || row.id || ""),
      ts: tsOrNow(row, fallbackNow),
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

  function openSession(provider: string, row: any): Sess {
    const evTs = tsOrNow(row, fallbackNow);
    const runnerJobId = row?.meta?.runner_job_id ? String(row.meta.runner_job_id) : null;
    const sid = makeSessionId(provider, evTs, runnerJobId);
    const s: Sess = {
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

  function closeSession(s: Sess) {
    sessions.push(s);
    openByProvider.delete(s.provider_id);
  }

  for (const row of rows) {
    const provider = String(row?.provider_id || "");
    if (!provider) continue;
    const act = String(row?.action_type || "");
    const verdict = String(row?.policy_verdict || "");
    const life = row?.meta?.lifecycle ? String(row.meta.lifecycle) : "";

    const isLogin = act === "login" || (life === "runner_job_started" && row?.meta?.runner_action === "web:login");
    const isHealthOk = act === "health" && verdict === "allowed";
    const isFail =
      verdict === "blocked" ||
      (life === "runner_job_finished" && String(row?.meta?.runner_status || "") === "failed");

    let s = openByProvider.get(provider);

    if (isLogin) {
      if (s) closeSession(s);
      openSession(provider, row);
      continue;
    }

    if (!s) continue;
    pushEvent(s, row);

    if (isHealthOk) {
      s.status = "ok";
      s.health_ok_trace_id = String(row.trace_id || row.id || "");
      s.ended_at = tsOrNow(row, fallbackNow);
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
      s.ended_at = tsOrNow(row, fallbackNow);
      closeSession(s);
      continue;
    }
  }

  return sessions;
}

function summarize(s: Sess) {
  const events = s.events || [];
  const duration_ms =
    s.started_at != null && s.ended_at != null ? Math.max(0, s.ended_at - s.started_at) : null;

  const action_counts: Record<string, number> = {};
  const verdict_counts: Record<string, number> = {};
  const lifecycle_counts: Record<string, number> = {};
  const exit_codes: Record<string, number> = {};
  let relogin_required_hits = 0;

  for (const ev of events) {
    if (ev.action_type) action_counts[ev.action_type] = (action_counts[ev.action_type] || 0) + 1;
    if (ev.verdict) verdict_counts[ev.verdict] = (verdict_counts[ev.verdict] || 0) + 1;
    if (ev.lifecycle) lifecycle_counts[ev.lifecycle] = (lifecycle_counts[ev.lifecycle] || 0) + 1;
    if (ev.action_type === "relogin_required") relogin_required_hits += 1;
    if (ev.exit_code !== null && ev.exit_code !== undefined) {
      const k = String(ev.exit_code);
      exit_codes[k] = (exit_codes[k] || 0) + 1;
    }
  }

  return {
    session_id: s.session_id,
    provider_id: s.provider_id,
    status: s.status,
    reason: s.reason,
    started_at: s.started_at,
    ended_at: s.ended_at,
    duration_ms,
    events: events.length,
    action_counts,
    verdict_counts,
    lifecycle_counts,
    exit_codes,
    relogin_required_hits,
    end_trace_id:
      s.status === "ok"
        ? s.health_ok_trace_id
        : s.events?.length
        ? s.events[s.events.length - 1].trace_id
        : null,
  };
}

function diffCounts(a: Record<string, number>, b: Record<string, number>) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out: Array<{ key: string; ok: number; failed: number; delta: number }> = [];
  for (const k of keys) {
    const ok = a?.[k] || 0;
    const failed = b?.[k] || 0;
    out.push({ key: k, ok, failed, delta: failed - ok });
  }
  return out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }
  const now = Date.now();

  const { searchParams } = new URL(req.url);
  const provider_id = String(searchParams.get("provider_id") || "").trim();
  const failed_session_id = String(searchParams.get("failed_session_id") || "").trim();
  const bytes = Math.max(
    64 * 1024,
    Math.min(2 * 1024 * 1024, Number(searchParams.get("bytes") || 256 * 1024))
  );
  const limit = Math.max(200, Math.min(5000, Number(searchParams.get("limit") || 2000)));

  if (!provider_id || !failed_session_id) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
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
    if (String(obj.provider_id || "") !== provider_id) continue;
    rows.push(obj);
  }

  const trimmed = rows.slice(Math.max(0, rows.length - limit));
  const sessions = buildSessions(trimmed, now);

  const idxFailed = sessions.findIndex((s) => s.session_id === failed_session_id);
  if (idxFailed < 0) {
    return NextResponse.json({ ok: false, error: "failed_session_not_found_in_window" }, { status: 404 });
  }

  const failed = sessions[idxFailed];
  if (failed.status !== "failed") {
    return NextResponse.json({ ok: false, error: "session_is_not_failed" }, { status: 400 });
  }

  let okSess: Sess | null = null;
  for (let i = idxFailed - 1; i >= 0; i--) {
    if (sessions[i].status === "ok") {
      okSess = sessions[i];
      break;
    }
  }
  if (!okSess) {
    return NextResponse.json({ ok: false, error: "no_previous_ok_session_found" }, { status: 404 });
  }

  const okSum = summarize(okSess);
  const failedSum = summarize(failed);

  const diff = {
    provider_id,
    ok_session_id: okSum.session_id,
    failed_session_id: failedSum.session_id,
    duration_ms: {
      ok: okSum.duration_ms,
      failed: failedSum.duration_ms,
      delta: (failedSum.duration_ms ?? 0) - (okSum.duration_ms ?? 0),
    },
    events: {
      ok: okSum.events,
      failed: failedSum.events,
      delta: failedSum.events - okSum.events,
    },
    relogin_required_hits: {
      ok: okSum.relogin_required_hits,
      failed: failedSum.relogin_required_hits,
      delta: failedSum.relogin_required_hits - okSum.relogin_required_hits,
    },
    verdicts: diffCounts(okSum.verdict_counts, failedSum.verdict_counts),
    lifecycles: diffCounts(okSum.lifecycle_counts, failedSum.lifecycle_counts),
    actions: diffCounts(okSum.action_counts, failedSum.action_counts),
    exit_codes: {
      ok: okSum.exit_codes,
      failed: failedSum.exit_codes,
    },
  };

  return NextResponse.json({
    ok: true,
    file,
    bytes_scanned: bytes,
    limit_rows: limit,
    ok_session: okSum,
    failed_session: failedSum,
    diff,
  });
}
