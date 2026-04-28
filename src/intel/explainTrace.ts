// @ts-nocheck
import fs from "fs";
import { EXPLAIN_MSG } from "#i18n/messages";
import { getTraceFile, traceExists } from "./traceWriter";

type TraceEvt = Record<string, any>;

export type TraceExplain = {
  trace_id: string;
  ok: boolean | null;
  total_ms: number | null;
  retry_of: string | null;
  stages: Array<{ name: string; at: number }>;
  errors: Array<{ at: number; message: string }>;
  last_event_at: number | null;
  raw_counts: Record<string, number>;
};

export function explainTrace(telegaRoot: string, traceId: string): TraceExplain {
  const p = getTraceFile(telegaRoot, traceId);
  const text = fs.readFileSync(p, "utf8");
  const lines = text.split("\n").filter(Boolean);

  const stages: TraceExplain["stages"] = [];
  const errors: TraceExplain["errors"] = [];
  const raw_counts: Record<string, number> = {};

  let startedAt: number | null = null;
  let endedAt: number | null = null;
  let ok: boolean | null = null;
  let retry_of: string | null = null;
  let last_event_at: number | null = null;

  for (const line of lines) {
    let e: TraceEvt;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }

    const kind = String(e.kind || "unknown");
    raw_counts[kind] = (raw_counts[kind] || 0) + 1;

    const at = Number(e.at || e._t || 0) || null;
    if (at) last_event_at = at;

    if (kind === "build.start") {
      startedAt = at ?? startedAt;
      if (e.retry_of) retry_of = String(e.retry_of);
    }
    if (kind === "stage" && e.name) stages.push({ name: String(e.name), at: at ?? 0 });
    if (kind === "error") errors.push({ at: at ?? 0, message: String(e.message || "error") });
    if (kind === "build.done") {
      ok = typeof e.ok === "boolean" ? e.ok : ok;
      endedAt = at ?? endedAt;
    }
  }

  const total_ms =
    startedAt != null && endedAt != null ? Math.max(0, endedAt - startedAt) : null;

  return { trace_id: traceId, ok, total_ms, retry_of, stages, errors, last_event_at, raw_counts };
}

export function formatTraceExplainText(x: TraceExplain) {
  const okLabel = x.ok === null ? "UNKNOWN" : x.ok ? "OK ✅" : "FAIL ❌";
  const msLabel = x.total_ms == null ? "—" : `${x.total_ms} ms`;

  const stageLines =
    x.stages.length === 0
      ? "—"
      : x.stages.map((s, i) => `${i + 1}) ${s.name}`).join("\n");

  const errLines =
    x.errors.length === 0
      ? "—"
      : x.errors.slice(0, 5).map((e) => `• ${e.message}`).join("\n");

  return [
    `🧾 Trace: ${x.trace_id}`,
    `${EXPLAIN_MSG.status}: ${okLabel}`,
    `${EXPLAIN_MSG.time}: ${msLabel}`,
    ``,
    `${EXPLAIN_MSG.stages}:`,
    stageLines,
    ``,
    `${EXPLAIN_MSG.errors}:`,
    errLines,
  ].join("\n");
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function okStr(v: boolean | null) {
  return v === null ? "UNKNOWN" : v ? "OK" : "FAIL";
}

function msStr(v: number | null) {
  return v == null ? "—" : `${v}ms`;
}

function stageDelta(prev: string[], cur: string[]) {
  const p = new Set(prev);
  const c = new Set(cur);
  const added = Array.from(c).filter((x) => !p.has(x));
  const removed = Array.from(p).filter((x) => !c.has(x));
  if (added.length === 0 && removed.length === 0) return "—";
  const parts: string[] = [];
  if (added.length) parts.push(`+${added.join(", ")}`);
  if (removed.length) parts.push(`-${removed.join(", ")}`);
  return parts.join(" ");
}

function normErrors(errs: Array<{ message: string }>, take = 3) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of errs) {
    const m = String(e.message || "").trim().toLowerCase();
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
    if (out.length >= take) break;
  }
  if (out.length === 0) return "—";
  return out.map((s) => `"${s}"`).join("; ");
}

export function walkRetryChain(telegaRoot: string, startId: string, maxDepth = 10) {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur = startId;
  let depth = 0;
  let root = startId;
  let truncated = false;
  let cycle = false;

  while (depth < maxDepth) {
    if (seen.has(cur)) {
      cycle = true;
      break;
    }
    seen.add(cur);
    chain.push(cur);

    const x = explainTrace(telegaRoot, cur);
    if (!x.retry_of) {
      root = cur;
      break;
    }

    cur = x.retry_of;
    depth++;
    root = cur;
  }

  if (depth === maxDepth) truncated = true;

  return { chain, depth: chain.length - 1, root, truncated, cycle };
}

export function formatTraceExplainWithDiff(telegaRoot: string, traceId: string) {
  const cur = explainTrace(telegaRoot, traceId);
  let text = formatTraceExplainText(cur);
  if (!cur.retry_of) return text;

  const oldId = cur.retry_of;
  if (!traceExists(telegaRoot, oldId)) {
    return `${text}\n\n${EXPLAIN_MSG.quickDiff(shortId(oldId))}\n${EXPLAIN_MSG.quickDiffUnavailable}`;
  }

  const prev = explainTrace(telegaRoot, oldId);
  const prevStages = prev.stages.map((s) => s.name);
  const curStages = cur.stages.map((s) => s.name);

  const diffLines = [
    EXPLAIN_MSG.statusLine(okStr(prev.ok), okStr(cur.ok)),
    EXPLAIN_MSG.timeLine(msStr(prev.total_ms), msStr(cur.total_ms)),
    EXPLAIN_MSG.stageDeltaLine(stageDelta(prevStages, curStages)),
    EXPLAIN_MSG.errorsLine(normErrors(prev.errors), normErrors(cur.errors)),
  ];

  const prevErr = prev.raw_counts.error ?? 0;
  const curErr = cur.raw_counts.error ?? 0;
  const prevStage = prev.raw_counts.stage ?? 0;
  const curStage = cur.raw_counts.stage ?? 0;
  if (prevErr !== curErr || prevStage !== curStage) {
    diffLines.push(EXPLAIN_MSG.eventsLine(prevErr, curErr, prevStage, curStage));
  }

  text += `\n\n${EXPLAIN_MSG.quickDiff(shortId(oldId))}\n${diffLines.join("\n")}`;

  const hint = buildRetryReasonHint(prev, cur);
  if (hint) {
    text +=
      `\n\n${EXPLAIN_MSG.retryReasonTitle}\n` +
      `• ${hint.reason}\n` +
      hint.evidence.map((s) => `• ${s}`).join("\n");
  }

  if (cur.ok === false || cur.errors.length > 0) {
    text += `\n\n${EXPLAIN_MSG.suggestedActionTitle}\n• ${suggestFix(cur)}`;
  }

  if (cur.retry_of) {
    const s = retrySummary(telegaRoot, traceId, 8);
    text +=
      `\n\n${EXPLAIN_MSG.retrySummaryTitle}\n` +
      `${EXPLAIN_MSG.depthRootLine(s.depth, shortId(s.root))}\n` +
      `${EXPLAIN_MSG.outcomeLine(s.outcome, s.tries)}\n` +
      `${EXPLAIN_MSG.determinismLine(s.deterministic)}`;
    if (s.truncated) text += `\n${EXPLAIN_MSG.noteTruncated(8)}`;
    if (s.cycle) text += `\n${EXPLAIN_MSG.warningCycle}`;

    const guard = walkRetryChain(telegaRoot, traceId, 10);
    const softLimit = 5;
    text +=
      `\n\n${EXPLAIN_MSG.chainGuardTitle}\n` +
      `${EXPLAIN_MSG.depthRootLine(guard.depth, shortId(guard.root))}\n` +
      `${EXPLAIN_MSG.chainLine(guard.chain.map(shortId).reverse().join(" → "))}`;
    if (guard.truncated) text += `\n${EXPLAIN_MSG.noteTruncated(10)}`;
    if (guard.cycle) text += `\n${EXPLAIN_MSG.warningCycle}`;
    if (guard.depth >= softLimit) {
      text += `\n${EXPLAIN_MSG.warningManyRetries}`;
    }
  }

  return text;
}

function lastStageName(x: TraceExplain) {
  if (x.stages.length === 0) return null;
  return x.stages[x.stages.length - 1]?.name || null;
}

function buildRetryReasonHint(prev: TraceExplain, cur: TraceExplain) {
  const prevLast = lastStageName(prev);
  const curLast = lastStageName(cur);
  const statusFlip = prev.ok !== cur.ok;

  if (prev.ok === false && cur.ok === true) {
    return {
      reason: EXPLAIN_MSG.hintResolved,
      evidence: [
        EXPLAIN_MSG.lineStatus(okStr(prev.ok), okStr(cur.ok)),
        EXPLAIN_MSG.lineStagePrevCur(prevLast ?? "—", curLast ?? "—"),
      ],
    };
  }

  if (prev.ok === false && cur.ok === false) {
    if (prevLast && curLast && prevLast === curLast) {
      return {
        reason: EXPLAIN_MSG.hintDeterministic,
        evidence: [
          EXPLAIN_MSG.lineStage(prevLast),
          EXPLAIN_MSG.lineErrorPrevCur(normErrors(prev.errors), normErrors(cur.errors)),
        ],
      };
    }
    if (prevLast && curLast && prevLast !== curLast) {
      return {
        reason: EXPLAIN_MSG.hintProgressed,
        evidence: [
          EXPLAIN_MSG.lineStagePrevCur(prevLast, curLast),
          EXPLAIN_MSG.lineErrorPrevCur(normErrors(prev.errors), normErrors(cur.errors)),
        ],
      };
    }
    return {
      reason: EXPLAIN_MSG.hintNoChange,
      evidence: [
        EXPLAIN_MSG.lineTopErrorPrevCur(normErrors(prev.errors), normErrors(cur.errors)),
        EXPLAIN_MSG.lineEventsError(prev.raw_counts.error ?? 0, cur.raw_counts.error ?? 0),
      ],
    };
  }

  if (prev.ok === true && cur.ok === false) {
    return {
      reason: EXPLAIN_MSG.hintRegression,
      evidence: [
        EXPLAIN_MSG.lineStatus(okStr(prev.ok), okStr(cur.ok)),
        EXPLAIN_MSG.lineErrorCur(normErrors(cur.errors)),
      ],
    };
  }

  if (statusFlip) {
    return {
      reason: EXPLAIN_MSG.hintOutcomeChanged,
      evidence: [
        EXPLAIN_MSG.lineStatus(okStr(prev.ok), okStr(cur.ok)),
        EXPLAIN_MSG.lineErrorsPrevCur(normErrors(prev.errors), normErrors(cur.errors)),
      ],
    };
  }

  return null;
}

function suggestFix(cur: TraceExplain) {
  const last = lastStageName(cur) || "—";
  const err0 = String(cur.errors[0]?.message || "").toLowerCase();

  if (last.includes("validate") || err0.includes("valid") || err0.includes("schema")) {
    return EXPLAIN_MSG.suggestValidation;
  }
  if (err0.includes("enoent") || err0.includes("no such file") || err0.includes("path")) {
    return EXPLAIN_MSG.suggestPath;
  }
  if (err0.includes("eacces") || err0.includes("permission")) {
    return EXPLAIN_MSG.suggestPerm;
  }
  if (
    err0.includes("timeout") ||
    err0.includes("socket") ||
    err0.includes("econn") ||
    err0.includes("epipe")
  ) {
    return EXPLAIN_MSG.suggestTransient;
  }
  if (last === "—" || cur.stages.length === 0) {
    return EXPLAIN_MSG.suggestTrace;
  }
  return EXPLAIN_MSG.suggestFallback;
}

function retrySummary(telegaRoot: string, traceId: string, max = 8) {
  const g = walkRetryChain(telegaRoot, traceId, max);

  const ids = g.chain.slice(0, max).reverse();
  const xs = ids.map((id) => explainTrace(telegaRoot, id)).filter(Boolean);

  if (xs.length === 0) {
    return {
      depth: g.depth,
      root: g.root,
      tries: 0,
      outcome: "UNKNOWN → UNKNOWN",
      deterministic: false,
      cycle: g.cycle,
      truncated: g.truncated,
    };
  }

  const first = xs[0];
  const last = xs[xs.length - 1];

  const lastStage = (x: TraceExplain) => x.stages.at(-1)?.name || "—";
  const topErr = (x: TraceExplain) => String(x.errors[0]?.message || "").trim().toLowerCase();

  const sigs = xs.map((x) => `${lastStage(x)}|${topErr(x)}`);
  const unique = new Set(sigs);

  const deterministic = unique.size <= Math.max(1, Math.floor(xs.length / 2));
  const outcome = `${okStr(first.ok)} → ${okStr(last.ok)}`;

  return {
    depth: g.depth,
    root: g.root,
    tries: xs.length,
    outcome,
    deterministic,
    cycle: g.cycle,
    truncated: g.truncated,
  };
}

export function buildReasonHintForSingleTrace(x: TraceExplain) {
  const last = x.stages.length ? x.stages[x.stages.length - 1]?.name || "—" : "—";
  const err = x.errors.length ? normErrors(x.errors) : "—";
  const errL = String(x.errors[0]?.message || "").toLowerCase();

  const transient =
    errL.includes("timeout") ||
    errL.includes("socket") ||
    errL.includes("econn") ||
    errL.includes("epipe") ||
    errL.includes("enoent") ||
    errL.includes("eacces");

  const validation =
    last.includes("validate") || errL.includes("valid") || errL.includes("schema");

  let reason = EXPLAIN_MSG.singleHintDefault;
  if (validation) {
    reason = EXPLAIN_MSG.singleHintValidation;
  } else if (transient) {
    reason = EXPLAIN_MSG.singleHintTransient;
  }

  return { reason, lastStage: last, error: err };
}
