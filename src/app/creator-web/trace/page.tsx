"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TraceRow = Record<string, any>;

function useQueryParam(name: string) {
  const [value, setValue] = useState<string>("");
  useEffect(() => {
    const url = new URL(window.location.href);
    setValue(url.searchParams.get(name) || "");
  }, [name]);
  return [value, setValue] as const;
}

function RowCard({ row, highlight }: { row: TraceRow; highlight?: boolean }) {
  const action = String(row?.action_type || "");
  const verdict = String(row?.policy_verdict || "");
  const provider = String(row?.provider_id || "");
  const traceId = String(row?.trace_id || row?.id || "");
  const ts = String(row?.created_at || "");
  const meta = row?.meta || {};
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: highlight
          ? "1px solid rgba(120,200,255,0.5)"
          : "1px solid rgba(255,255,255,0.12)",
        background: highlight ? "rgba(120,200,255,0.08)" : "rgba(255,255,255,0.04)",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => window.open("/creator-web/timeline", "_blank", "noopener,noreferrer")}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            cursor: "pointer",
          }}
        >
          Provider timeline
        </button>
        <span>action: {action || "—"}</span>
        <span>verdict: {verdict || "—"}</span>
        <span>provider: {provider || "—"}</span>
        <span>trace: {traceId}</span>
        <span>time: {ts || "—"}</span>
      </div>
      <div style={{ marginTop: 8, opacity: 0.8, whiteSpace: "pre-wrap" }}>
        {JSON.stringify(meta, null, 2)}
      </div>
    </div>
  );
}

function fmtTs(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function pillStyle() {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
  } as const;
}

function bannerStyle(kind: "ok" | "warn" | "bad") {
  if (kind === "bad") {
    return {
      padding: 12,
      borderRadius: 12,
      border: "1px solid rgba(255,120,120,0.35)",
      background: "rgba(255,120,120,0.10)",
    };
  }
  if (kind === "warn") {
    return {
      padding: 12,
      borderRadius: 12,
      border: "1px solid rgba(255,200,120,0.35)",
      background: "rgba(255,200,120,0.10)",
    };
  }
  return {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(120,200,255,0.35)",
    background: "rgba(120,200,255,0.10)",
  };
}

function classifyMini(m: any): {
  cls: "blocked" | "relogin" | "runner_failed" | "runner_timeout" | "ok";
  title: string;
} {
  const verdict = String(m?.policy_verdict || "");
  const life = String(m?.lifecycle || "");
  const runnerStatus = String(m?.runner_status || "");
  const act = String(m?.action_type || "");

  if (verdict === "blocked") return { cls: "blocked", title: `blocked • ${act}` };
  if (life === "relogin_required") return { cls: "relogin", title: `relogin • ${act}` };
  if (life === "runner_job_finished" && runnerStatus === "failed") {
    return { cls: "runner_failed", title: `runner failed • ${act}` };
  }
  if (life === "runner_job_finished" && runnerStatus === "timeout") {
    return { cls: "runner_timeout", title: `runner timeout • ${act}` };
  }
  return { cls: "ok", title: act ? `ok • ${act}` : "ok" };
}

function dotStyle(
  kind: string,
  isCenter: boolean,
  isSelected: boolean,
  marked: boolean,
  jumped: boolean
) {
  const base: any = {
    width: isCenter ? 14 : 10,
    height: isCenter ? 14 : 10,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.18)",
    cursor: "pointer",
    display: "inline-block",
  };

  if (kind === "blocked" || kind === "runner_failed") base.background = "rgba(255,120,120,0.75)";
  else if (kind === "relogin" || kind === "runner_timeout")
    base.background = "rgba(255,200,120,0.75)";
  else base.background = "rgba(120,200,255,0.65)";

  if (marked) {
    base.boxShadow = "0 0 0 3px rgba(255,255,255,0.28)";
  }
  if (jumped) {
    base.boxShadow = "0 0 0 3px rgba(160,220,255,0.45)";
  }
  if (isSelected) {
    base.boxShadow = "0 0 0 3px rgba(255,255,255,0.18)";
  }
  if (isCenter) {
    base.boxShadow = "0 0 0 3px rgba(255,255,255,0.10)";
  }
  return base;
}

function pickVal(v: any) {
  const s = String(v ?? "");
  return s.length ? s : "(empty)";
}

function deltaVsCenter(centerMini: any, m: any) {
  const deltas: Array<{ key: string; from: string; to: string }> = [];
  if (!centerMini || !m) return deltas;

  const pairs: Array<[string, any, any]> = [
    ["policy_verdict", centerMini?.policy_verdict, m?.policy_verdict],
    ["lifecycle", centerMini?.lifecycle, m?.lifecycle],
    ["runner_status", centerMini?.runner_status, m?.runner_status],
  ];

  for (const [k, a, b] of pairs) {
    const from = pickVal(a);
    const to = pickVal(b);
    if (from !== to) deltas.push({ key: k, from, to });
  }

  const prio: Record<string, number> = { policy_verdict: 1, lifecycle: 2, runner_status: 3 };
  deltas.sort((x, y) => (prio[x.key] || 99) - (prio[y.key] || 99));
  return deltas.slice(0, 2);
}

function oneLine(s: any) {
  const t = String(s ?? "").trim();
  return t.length ? t : "(empty)";
}

function line2(m: any) {
  const v = oneLine(m?.policy_verdict);
  const life = oneLine(m?.lifecycle);
  const rs = oneLine(m?.runner_status);
  return `${v} • ${life} • ${rs}`;
}

function tipStyle() {
  return {
    position: "fixed" as const,
    zIndex: 80,
    pointerEvents: "none" as const,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(20,20,24,0.96)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    maxWidth: 360,
    whiteSpace: "nowrap" as const,
  };
}

function isTypingTarget(t: any) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = String((el as any).tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as any).isContentEditable) return true;
  return false;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function idxFromClientX(el: HTMLElement, clientX: number, len: number) {
  const r = el.getBoundingClientRect();
  const x = clamp(clientX - r.left, 0, Math.max(1, r.width));
  const t = r.width > 0 ? x / r.width : 0;
  const idx = Math.floor(t * len);
  return clamp(idx, 0, len - 1);
}

type RootCause =
  | "policy_blocked"
  | "relogin_required"
  | "runner_failed"
  | "runner_timeout"
  | "missing_human_interaction"
  | "unknown";

function kv(k: string, v: any) {
  const val = v === undefined || v === null || v === "" ? "(empty)" : String(v);
  return `${k}=${val}`;
}

function analyzeRootCause(row: TraceRow) {
  const verdict = String(row?.policy_verdict || "");
  const act = String(row?.action_type || "");
  const meta = row?.meta || {};
  const life = String(meta?.lifecycle || "");
  const runnerStatus = String(meta?.runner_status || "");
  const exitCode = meta?.exit_code ?? null;
  const reason = String(meta?.reason || "");
  const runnerAction = String(meta?.runner_action || "");

  // Priority 1: policy blocked
  if (verdict === "blocked") {
    return {
      cause: "policy_blocked" as RootCause,
      evidence: [kv("policy_verdict", verdict), kv("meta.lifecycle", life)],
      hints: [
        "Проверь policy_id и почему действие заблокировано (нужно поле/разрешение/ручной режим).",
        runnerAction
          ? `Проверь runner_action: ${runnerAction} (возможно, действие не разрешено политикой).`
          : "Смотри meta: какие условия сработали.",
      ]
        .filter(Boolean)
        .slice(0, 2),
    };
  }

  // Priority 2: relogin required
  if (life === "relogin_required" || act === "relogin_required") {
    return {
      cause: "relogin_required" as RootCause,
      evidence: [kv("meta.lifecycle", life || "(empty)"), kv("action_type", act)],
      hints: [
        "Нажми Retry на сессии: будет запущен web:login через runnerd.",
        "Если повторяется — проверь, не истёк ли токен/куки провайдера и нужен ли ручной шаг (2FA/капча).",
      ].slice(0, 2),
    };
  }

  // Priority 3: runner failed
  if (life === "runner_job_finished" && runnerStatus === "failed") {
    const hints: string[] = [
      meta?.runner_job_id
        ? `Открой runner job: ${String(meta.runner_job_id)} и посмотри stderr/exit_code.`
        : "Открой runner job и посмотри stderr/exit_code.",
      exitCode != null
        ? `Exit code=${String(exitCode)} — это уже конкретный “тип падения” раннера.`
        : "Если есть exit_code — он даст тип падения.",
    ];
    return {
      cause: "runner_failed" as RootCause,
      evidence: [
        kv("meta.lifecycle", life),
        kv("meta.runner_status", runnerStatus),
        kv("meta.exit_code", exitCode),
      ],
      hints: hints.filter(Boolean).slice(0, 2),
    };
  }

  // Priority 4: runner timeout
  if (life === "runner_job_finished" && runnerStatus === "timeout") {
    return {
      cause: "runner_timeout" as RootCause,
      evidence: [kv("meta.lifecycle", life), kv("meta.runner_status", runnerStatus)],
      hints: [
        "Увеличь таймаут раннера для web:login или проверь задержки сети/прокси.",
        "Если часто — проверь стабильность провайдера/доступность страницы логина.",
      ].slice(0, 2),
    };
  }

  // Optional: missing human interaction (if explicitly marked)
  if (reason === "missing_human_interaction" || life === "missing_human_interaction") {
    return {
      cause: "missing_human_interaction" as RootCause,
      evidence: [kv("meta.lifecycle", life), kv("meta.reason", reason)],
      hints: [
        "Требуется ручное действие (подтверждение/капча/2FA).",
        "Выполни вход вручную и повтори health.",
      ].slice(0, 2),
    };
  }

  // Unknown
  const ev = [
    verdict ? kv("policy_verdict", verdict) : null,
    life ? kv("meta.lifecycle", life) : null,
    act ? kv("action_type", act) : null,
    reason ? kv("meta.reason", reason) : null,
  ].filter(Boolean) as string[];

  return {
    cause: "unknown" as RootCause,
    evidence: ev.length ? ev : ["(insufficient_evidence)"],
    hints: [
      "Не хватает сигнала. Добавь в trace meta.lifecycle / meta.runner_status, чтобы диагноз стал детерминированным.",
      "Открой соседние trace рядом по времени (до/после) — часто причина проявляется там.",
    ].slice(0, 2),
  };
}

export default function CreatorWebTracePage() {
  const [traceId, setTraceId] = useQueryParam("trace_id");
  const [n, setN] = useState<number>(40);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [center, setCenter] = useState<TraceRow | null>(null);
  const [windowRows, setWindowRows] = useState<TraceRow[]>([]);
  const [chainRows, setChainRows] = useState<TraceRow[]>([]);
  const [runnerJobId, setRunnerJobId] = useState<string | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [filterProvider, setFilterProvider] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterVerdict, setFilterVerdict] = useState("");
  const [neighbors, setNeighbors] = useState<any | null>(null);
  const [neighborsErr, setNeighborsErr] = useState<string | null>(null);
  const [neighborsLoading, setNeighborsLoading] = useState(false);
  const [selectedMini, setSelectedMini] = useState<any | null>(null);
  const [stripTip, setStripTip] = useState<{
    open: boolean;
    x: number;
    y: number;
    a1: string;
    a2: string;
    trace_id: string;
  } | null>(null);
  const [markers, setMarkers] = useState<Record<string, true>>({});
  const [binsIndex, setBinsIndex] = useState<string[]>([]);
  const [activeBin, setActiveBin] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  type ChipFocus =
    | { list: "pinned"; idx: number }
    | { list: "recent"; idx: number }
    | null;

  const [chipFocus, setChipFocus] = useState<ChipFocus>(null);
  const [searchResults, setSearchResults] = useState<Array<{ bin: string; tid: string; info?: any }>>(
    []
  );
  const [resultFocus, setResultFocus] = useState<number>(-1);
  const [searchHints, setSearchHints] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<"marked" | "visible">("marked");
  const [jumpedTraceId, setJumpedTraceId] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [pinnedQueries, setPinnedQueries] = useState<string[]>([]);
  type SearchPreset = {
    name: string;
    query: string;
    mode: "marked" | "visible";
  };

  const [searchPresets, setSearchPresets] = useState<SearchPreset[]>([]);
  const [pendingJump, setPendingJump] = useState<{
    tid: string;
    bin: string;
    requestedAt: number;
    tries: number;
  } | null>(null);
  const [jumpErr, setJumpErr] = useState<string | null>(null);
  const [jumpSeeking, setJumpSeeking] = useState(false);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const lastHapticAtRef = useRef(0);
  const lastHapticIdxRef = useRef<number | null>(null);
  const rc = center ? analyzeRootCause(center) : null;
  const providerKey = useMemo(
    () => String(center?.provider_id || ""),
    [center?.provider_id]
  );

  async function load() {
    if (!traceId) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(
        `/api/creator-web/trace/window?trace_id=${encodeURIComponent(traceId)}&n=${encodeURIComponent(
          String(n)
        )}`,
        { cache: "no-store" }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "fetch_failed");
      setCenter(j?.center || null);
      setWindowRows(Array.isArray(j?.window?.rows) ? j.window.rows : []);
      setChainRows(Array.isArray(j?.chain?.rows) ? j.chain.rows : []);
      setRunnerJobId(j?.chain?.runner_job_id || null);
    } catch (e: any) {
      setErr(e?.message || "fetch_failed");
      setCenter(null);
      setWindowRows([]);
      setChainRows([]);
      setRunnerJobId(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecent() {
    const qs = new URLSearchParams();
    qs.set("limit", "120");
    if (filterProvider) qs.set("provider_id", filterProvider);
    if (filterAction) qs.set("action_type", filterAction);
    if (filterVerdict) qs.set("policy_verdict", filterVerdict);

    const r = await fetch(`/api/creator-web/trace/recent?${qs.toString()}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.ok && Array.isArray(j.items)) setRecent(j.items);
  }

  async function loadNeighbors(centerTraceId: string) {
    if (!centerTraceId) return;
    setNeighborsLoading(true);
    setNeighborsErr(null);
    try {
      const qs = new URLSearchParams();
      qs.set("trace_id", centerTraceId);
      qs.set("n", "3");
      const r = await fetch(`/api/creator-web/trace/neighbors?${qs.toString()}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "neighbors_failed");
      setNeighbors(j);
    } catch (e: any) {
      setNeighborsErr(String(e?.message || e));
      setNeighbors(null);
    } finally {
      setNeighborsLoading(false);
    }
  }

  useEffect(() => {
    if (traceId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traceId]);

  useEffect(() => {
    loadRecent();
    const t = setInterval(loadRecent, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProvider, filterAction, filterVerdict]);

  useEffect(() => {
    const tid = String(center?.trace_id || center?.id || "");
    if (tid) loadNeighbors(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(center?.trace_id || center?.id || "")]);

  useEffect(() => {
    setSelectedMini(null);
    setStripTip(null);
  }, [String(center?.trace_id || center?.id || "")]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (!neighbors || !Array.isArray((neighbors as any).timeline) || !(neighbors as any).timeline.length) {
        return;
      }

      const timeline = (neighbors as any).timeline as any[];
      const centerIndex = Number((neighbors as any).center_index || 0);

      const selectedId = String(selectedMini?.trace_id || "");
      let idx = selectedId
        ? timeline.findIndex((x) => String(x?.trace_id || "") === selectedId)
        : -1;

      if (idx < 0) idx = clamp(centerIndex, 0, timeline.length - 1);

      const key = String(e.key || "");
      const lower = key.length === 1 ? key.toLowerCase() : key;

      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedMini(null);
        setStripTip(null);
        return;
      }

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if ((e as any).shiftKey) {
          setSelectedMini(null);
          setStripTip(null);
          return;
        }

        const m = timeline[idx];
        const tid = String(m?.trace_id || "");
        if (tid) openTrace(tid);
        return;
      }

      if (lower === "m") {
        e.preventDefault();
        if ((e as any).shiftKey) {
          clearMarkers();
          return;
        }

        const m = timeline[idx];
        const tid = String(m?.trace_id || "");
        if (tid) toggleMarker(tid);
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || lower === "j" || lower === "l") {
        e.preventDefault();
        const dir =
          e.key === "ArrowRight" || lower === "l"
            ? 1
            : e.key === "ArrowLeft" || lower === "j"
              ? -1
              : 0;
        const step = (e as any).shiftKey ? 2 : 1;
        const nextIdx = clamp(idx + dir * step, 0, timeline.length - 1);
        const m = timeline[nextIdx];
        if (m) {
          setSelectedMini(m);
          setStripTip(null);
          hapticTick(nextIdx);
        }
        return;
      }

      if (lower === "k") {
        e.preventDefault();
        const kIdx = clamp(centerIndex, 0, timeline.length - 1);
        const m = timeline[kIdx];
        if (m) {
          setSelectedMini(m);
          setStripTip(null);
          hapticTick(kIdx);
        }
        return;
      }

      if (e.key === "Enter") {
        const m = timeline[idx];
        const tid = String(m?.trace_id || "");
        if (tid) {
          e.preventDefault();
          openTrace(tid);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [neighbors, openTrace, selectedMini, setSelectedMini, setStripTip]);

  function hapticTick(nextIdx: number) {
    if (typeof window === "undefined") return;
    if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) return;
    const vib = (navigator as any)?.vibrate;
    if (typeof vib !== "function") return;
    if (lastHapticIdxRef.current === nextIdx) return;
    const now = Date.now();
    if (now - lastHapticAtRef.current < 60) return;
    lastHapticAtRef.current = now;
    lastHapticIdxRef.current = nextIdx;
    try {
      vib(5);
    } catch {}
  }

  function isMarked(tid: string) {
    return !!markers[tid];
  }

  function toggleMarker(tid: string) {
    if (!tid) return;
    setMarkers((m) => {
      const next = { ...m };
      if (next[tid]) delete next[tid];
      else next[tid] = true;
      return next;
    });
  }

  function clearMarkers() {
    setMarkers({});
  }

  function normalizeBinId(s: string) {
    return String(s || "unknown")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_");
  }

  function markersStorageKey(binId: string) {
    return `mc.bins.v1.markers.${binId}`;
  }

  function recentSearchKey() {
    return "mc.search.v1.recent";
  }

  function pinnedSearchKey() {
    return "mc.search.v1.pinned";
  }

  function searchPresetsKey() {
    return "mc.search.v1.presets";
  }

  function lastSearchQueryKey() {
    return "mc.search.v1.last.query";
  }

  function lastSearchModeKey() {
    return "mc.search.v1.last.mode";
  }
  function binsIndexKey() {
    return "mc.bins.v1.index";
  }

  function binsActiveKey() {
    return "mc.bins.v1.active";
  }

  function getMarkersForBin(binId: string): Record<string, true> {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(markersStorageKey(binId));
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object") return parsed as Record<string, true>;
    } catch {}
    return {};
  }

  function normalizeQuery(q: string) {
    return String(q || "").trim();
  }

  function normalizeQueryKey(q: string) {
    return normalizeQuery(q).toLowerCase();
  }

  function truncateQuery(q: string) {
    const s = normalizeQuery(q);
    if (s.length <= 96) return s;
    return s.slice(0, 96);
  }

  function applySearch(q: string, addRecent = true) {
    const v = truncateQuery(q);
    if (!v) return;
    setSearchQuery(v);
    if (addRecent) {
      setRecentQueries((prev) => {
        const key = normalizeQueryKey(v);
        const next = prev.filter((x) => normalizeQueryKey(x) !== key);
        next.unshift(v);
        return next.slice(0, 10);
      });
    }
  }

  function chipCount() {
    return (pinnedQueries?.length || 0) + (recentQueries?.length || 0);
  }

  function focusToFlat(f: ChipFocus): number {
    if (!f) return -1;
    const p = pinnedQueries?.length || 0;
    if (f.list === "pinned") return Math.max(0, Math.min(p - 1, f.idx));
    const r = recentQueries?.length || 0;
    return p + Math.max(0, Math.min(r - 1, f.idx));
  }

  function flatToFocus(flat: number): ChipFocus {
    const p = pinnedQueries?.length || 0;
    const r = recentQueries?.length || 0;
    const total = p + r;
    if (total <= 0) return null;
    const i = Math.max(0, Math.min(total - 1, flat));
    if (i < p) return { list: "pinned", idx: i };
    return { list: "recent", idx: i - p };
  }

  function getFocusedQuery(f: ChipFocus): string {
    if (!f) return "";
    if (f.list === "pinned") return String(pinnedQueries?.[f.idx] || "");
    return String(recentQueries?.[f.idx] || "");
  }

  function setChipFocusClamped(next: ChipFocus) {
    if (!next) {
      setChipFocus(null);
      return;
    }
    const p = pinnedQueries?.length || 0;
    const r = recentQueries?.length || 0;
    if (next.list === "pinned") {
      if (p <= 0) return setChipFocus(flatToFocus(0));
      return setChipFocus({ list: "pinned", idx: Math.max(0, Math.min(p - 1, next.idx)) });
    }
    if (r <= 0) {
      if (p <= 0) return setChipFocus(null);
      return setChipFocus({ list: "pinned", idx: Math.max(0, Math.min(p - 1, 0)) });
    }
    return setChipFocus({ list: "recent", idx: Math.max(0, Math.min(r - 1, next.idx)) });
  }

  function stepChip(delta: number) {
    const total = chipCount();
    if (total <= 0) return;
    const curFlat = focusToFlat(chipFocus);
    const nextFlat = curFlat < 0 ? (delta > 0 ? 0 : total - 1) : curFlat + delta;
    setChipFocus(flatToFocus(nextFlat));
  }

  function togglePinned(q: string) {
    const v = truncateQuery(q);
    if (!v) return;
    setPinnedQueries((prev) => {
      const key = normalizeQueryKey(v);
      const exists = prev.some((x) => normalizeQueryKey(x) === key);
      if (exists) return prev.filter((x) => normalizeQueryKey(x) !== key);
      const next = [v, ...prev];
      return next.slice(0, 10);
    });
  }

  function removeRecent(q: string) {
    const key = normalizeQueryKey(q);
    setRecentQueries((prev) => prev.filter((x) => normalizeQueryKey(x) !== key));
  }

  function savePreset() {
    const q = truncateQuery(searchQuery);
    if (!q) return;
    const name =
      window.prompt("Preset name:", q.slice(0, 24))?.trim().slice(0, 32) || "";
    if (!name) return;

    setSearchPresets((prev) => {
      const key = `${name.toLowerCase()}::${q.toLowerCase()}::${searchMode}`;
      const next = prev.filter(
        (p) =>
          `${p.name.toLowerCase()}::${p.query.toLowerCase()}::${p.mode}` !== key
      );
      next.unshift({ name, query: q, mode: searchMode });
      return next.slice(0, 10);
    });
  }

  function applyPreset(p: SearchPreset) {
    setSearchMode(p.mode);
    applySearch(p.query, true);
  }

  function renamePreset(p: SearchPreset) {
    const cur = String(p?.name || "").trim();
    if (!cur) return;
    const nextName =
      window.prompt("Rename preset:", cur)?.trim().slice(0, 32) || "";
    if (!nextName) return;

    setSearchPresets((prev) => {
      const keyTarget = `${p.name.toLowerCase()}::${p.query.toLowerCase()}::${p.mode}`;
      const keyNext = `${nextName.toLowerCase()}::${p.query.toLowerCase()}::${p.mode}`;
      if (keyTarget === keyNext) return prev;

      const exists = prev.some(
        (x) =>
          `${x.name.toLowerCase()}::${x.query.toLowerCase()}::${x.mode}` ===
          keyNext
      );
      if (exists) return prev;

      return prev.map((x) => {
        const k = `${x.name.toLowerCase()}::${x.query.toLowerCase()}::${x.mode}`;
        if (k !== keyTarget) return x;
        return { ...x, name: nextName };
      });
    });
  }

  function removePreset(p: SearchPreset) {
    setSearchPresets((prev) =>
      prev.filter(
        (x) =>
          !(
            x.name === p.name &&
            x.query === p.query &&
            x.mode === p.mode
          )
      )
    );
  }

  function miniLabelFromTimeline(tid: string) {
    const tl = (neighbors as any)?.timeline;
    if (!Array.isArray(tl)) return null;
    const m = tl.find((x: any) => String(x?.trace_id || "") === tid);
    if (!m) return null;
    return {
      action: oneLine(m?.action_type),
      line2: line2(m),
      ts: m?.ts != null ? String(m.ts) : "",
      mini: m,
    };
  }

  const markerIds = useMemo(() => Object.keys(markers), [markers]);

  const markerItems = useMemo(() => {
    return markerIds.map((tid) => {
      const info = miniLabelFromTimeline(tid);
      return { tid, info };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerIds, neighbors]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    function onWheelNative(e: WheelEvent) {
      // Intentionally empty: ensures non-passive wheel listener is attached
      // so preventDefault works in React handler.
    }

    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative as any);
  }, [stripRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(binsIndexKey());
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setBinsIndex(parsed as string[]);
      }
    } catch {}
    try {
      const raw = window.localStorage.getItem(binsActiveKey());
      const parsed = raw ? String(raw) : "";
      if (parsed) setActiveBin(parsed);
    } catch {}
    try {
      const raw = window.localStorage.getItem(recentSearchKey());
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setRecentQueries(parsed as string[]);
    } catch {}
    try {
      const raw = window.localStorage.getItem(pinnedSearchKey());
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setPinnedQueries(parsed as string[]);
    } catch {}
    try {
      const raw = window.localStorage.getItem(searchPresetsKey());
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const clean = parsed
          .filter((p) => p && typeof p.name === "string" && typeof p.query === "string")
          .map((p) => ({
            name: String(p.name).slice(0, 32),
            query: truncateQuery(String(p.query)),
            mode: p.mode === "visible" ? "visible" : "marked",
          }))
          .filter((p) => p.query);
        setSearchPresets(clean.slice(0, 10));
      }
    } catch {}
    try {
      const raw = window.localStorage.getItem(lastSearchModeKey());
      const v = String(raw || "").trim();
      if (v === "marked" || v === "visible") setSearchMode(v);
    } catch {}
    try {
      const raw = window.localStorage.getItem(lastSearchQueryKey());
      const v = truncateQuery(String(raw || ""));
      if (v) setSearchQuery(v);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!providerKey) return;
    const pid = normalizeBinId(providerKey);
    if (!pid) return;
    setBinsIndex((prev) => (prev.includes(pid) ? prev : [pid, ...prev]));
    if (!activeBin) setActiveBin(pid);
  }, [providerKey, activeBin]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(binsIndexKey(), JSON.stringify(binsIndex));
    } catch {}
  }, [binsIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(recentSearchKey(), JSON.stringify(recentQueries));
    } catch {}
  }, [recentQueries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(pinnedSearchKey(), JSON.stringify(pinnedQueries));
    } catch {}
  }, [pinnedQueries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(
          searchPresetsKey(),
          JSON.stringify(searchPresets.slice(0, 10))
        );
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [searchPresets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(lastSearchModeKey(), String(searchMode || "marked"));
      } catch {}
      try {
        const v = truncateQuery(searchQuery);
        if (v) window.localStorage.setItem(lastSearchQueryKey(), v);
        else window.localStorage.removeItem(lastSearchQueryKey());
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery, searchMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeBin) return;
    try {
      window.localStorage.setItem(binsActiveKey(), activeBin);
    } catch {}
  }, [activeBin]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeBin) return;
    try {
      const raw = window.localStorage.getItem(markersStorageKey(activeBin));
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object") {
        setMarkers(parsed as Record<string, true>);
      } else {
        setMarkers({});
      }
    } catch {
      setMarkers({});
    }
  }, [activeBin]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeBin) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(markersStorageKey(activeBin), JSON.stringify(markers));
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [markers, activeBin]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      const results: Array<{
        bin: string;
        tid: string;
        info?: any;
        matchType: number;
        dist?: number;
        ts?: number;
      }> = [];
      const matchRank = (hay: string, needle: string) => {
        if (hay === needle) return 0;
        if (hay.startsWith(needle)) return 1;
        if (hay.includes(needle)) return 2;
        return 3;
      };
      if (searchMode === "visible") {
        const tl = (neighbors as any)?.timeline;
        if (Array.isArray(tl)) {
          const centerIdx = Number((neighbors as any)?.center_index || 0);
          for (let i = 0; i < tl.length; i++) {
            const m = tl[i];
            const tid = String(m?.trace_id || "");
            if (!tid) continue;
            const hay = [
              tid,
              String(m?.action_type || ""),
              String(m?.policy_verdict || ""),
              String(m?.lifecycle || ""),
              String(m?.runner_status || ""),
            ]
              .join(" ")
              .toLowerCase();
            if (!hay.includes(q)) continue;
            const mt = matchRank(hay, q);
            results.push({
              bin: activeBin || "",
              tid,
              info: {
                action: oneLine(m?.action_type),
                line2: line2(m),
                ts: m?.ts != null ? String(m.ts) : "",
                mini: m,
              },
              matchType: mt,
              dist: Math.abs(i - centerIdx),
              ts: typeof m?.ts === "number" ? m.ts : undefined,
            });
          }
        }
      } else {
        for (const bin of binsIndex) {
          const mm = getMarkersForBin(bin);
          for (const tid of Object.keys(mm || {})) {
            const hay = tid.toLowerCase();
            if (!hay.includes(q)) continue;
            const mt = matchRank(hay, q);
            const info = bin === activeBin ? miniLabelFromTimeline(tid) : null;
            results.push({
              bin,
              tid,
              info: info || undefined,
              matchType: mt,
              ts: info?.mini?.ts,
            });
          }
        }
      }
      const seen = new Map<string, typeof results[number]>();
      for (const r of results) {
        const key = searchMode === "visible" ? r.tid : `${r.bin}:${r.tid}`;
        const prev = seen.get(key);
        if (!prev) {
          seen.set(key, r);
          continue;
        }
        if (r.matchType < prev.matchType) {
          seen.set(key, r);
          continue;
        }
        if (r.matchType === prev.matchType) {
          const distA = r.dist ?? Number.POSITIVE_INFINITY;
          const distB = prev.dist ?? Number.POSITIVE_INFINITY;
          if (distA < distB) {
            seen.set(key, r);
            continue;
          }
          const tsA = r.ts ?? 0;
          const tsB = prev.ts ?? 0;
          if (tsA > tsB) {
            seen.set(key, r);
          }
        }
      }
      const ranked = Array.from(seen.values()).sort((a, b) => {
        if (a.matchType !== b.matchType) return a.matchType - b.matchType;
        const da = a.dist ?? Number.POSITIVE_INFINITY;
        const db = b.dist ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        const ta = a.ts ?? 0;
        const tb = b.ts ?? 0;
        return tb - ta;
      });
      setSearchResults(ranked.slice(0, 200));
    }, 150);
    return () => clearTimeout(t);
  }, [searchQuery, binsIndex, activeBin, neighbors, searchMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = String(searchQuery || "").trim();
    if (q) {
      setSearchHints([]);
      return;
    }
    if (searchMode !== "visible") {
      setSearchHints([]);
      return;
    }
    const tl = (neighbors as any)?.timeline;
    if (!Array.isArray(tl) || tl.length <= 0) {
      setSearchHints([]);
      return;
    }
    const freq = new Map<string, number>();
    const add = (v: any) => {
      const s = String(v || "").trim();
      if (!s) return;
      const t = s.length > 48 ? s.slice(0, 48) : s;
      freq.set(t, (freq.get(t) || 0) + 1);
    };
    for (const m of tl) {
      add(m?.action_type);
      add(m?.policy_verdict);
      add(m?.lifecycle);
      add(m?.runner_status);
    }
    const ranked = Array.from(freq.entries())
      .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
      .map(([k]) => k)
      .slice(0, 10);
    setSearchHints(ranked);
  }, [neighbors, searchMode, searchQuery]);

  useEffect(() => {
    if (!searchResults?.length) {
      setResultFocus(-1);
      return;
    }
    setResultFocus((cur) => {
      if (cur < 0) return 0;
      if (cur >= searchResults.length) return searchResults.length - 1;
      return cur;
    });
  }, [searchResults]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onKeyDown(e: KeyboardEvent) {
      const key = String(e.key || "");
      const lower = key.length === 1 ? key.toLowerCase() : key;

      if ((e.metaKey || e.ctrlKey) && lower === "k") {
        e.preventDefault();
        setChipFocus(null);
        try {
          searchInputRef.current?.focus();
          searchInputRef.current?.select?.();
        } catch {}
        return;
      }

      if (key === "Escape") {
        if (searchQuery || (searchResults?.length || 0) > 0) {
          e.preventDefault();
          setSearchQuery("");
          setSearchResults([]);
        }
        setChipFocus(null);
        return;
      }

      const active = document?.activeElement as any;
      const isTypingInSearch =
        !!active &&
        (active === searchInputRef.current ||
          String(active?.tagName || "").toLowerCase() === "input" ||
          String(active?.tagName || "").toLowerCase() === "textarea");

      if (isTypingInSearch) return;

      const hasResults = (searchResults?.length || 0) > 0;
      if (hasResults) {
        if (key === "ArrowDown") {
          e.preventDefault();
          setChipFocus(null);
          setResultFocus((cur) => {
            const next = cur < 0 ? 0 : cur + 1;
            return Math.min(next, (searchResults.length || 1) - 1);
          });
          return;
        }
        if (key === "ArrowUp") {
          e.preventDefault();
          setChipFocus(null);
          setResultFocus((cur) => {
            const next = cur < 0 ? (searchResults.length || 1) - 1 : cur - 1;
            return Math.max(next, 0);
          });
          return;
        }
        if (key === "Enter") {
          const i = resultFocus < 0 ? 0 : resultFocus;
          const item = searchResults?.[i];
          if (!item) return;
          e.preventDefault();
          setChipFocus(null);
          if (e.metaKey || e.ctrlKey) {
            applySearch(searchQuery, true);
            openTrace(item.tid);
          } else {
            applySearch(searchQuery, true);
            requestJump(item.tid, item.bin);
          }
          return;
        }
      }

      if (lower === "/") {
        e.preventDefault();
        setChipFocus(null);
        try {
          searchInputRef.current?.focus();
          searchInputRef.current?.select?.();
        } catch {}
        return;
      }

      if (lower === "p") {
        const q = truncateQuery(searchQuery);
        if (q) {
          e.preventDefault();
          togglePinned(q);
        }
        return;
      }

      if (hasResults && (lower === "j" || lower === "o")) {
        const i = resultFocus < 0 ? 0 : resultFocus;
        const item = searchResults?.[i];
        if (!item) return;
        e.preventDefault();
        setChipFocus(null);
        applySearch(searchQuery, true);
        if (lower === "o") {
          openTrace(item.tid);
        } else {
          requestJump(item.tid, item.bin);
        }
        return;
      }

      if (key === "ArrowRight" || key === "ArrowDown") {
        if (chipCount() <= 0) return;
        e.preventDefault();
        stepChip(+1);
        return;
      }
      if (key === "ArrowLeft" || key === "ArrowUp") {
        if (chipCount() <= 0) return;
        e.preventDefault();
        stepChip(-1);
        return;
      }

      if (key === "Enter") {
        const q = getFocusedQuery(chipFocus);
        if (!q) return;
        e.preventDefault();
        applySearch(q, true);
        setChipFocus(null);
        try {
          searchInputRef.current?.focus();
          searchInputRef.current?.select?.();
        } catch {}
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chipFocus, pinnedQueries, recentQueries, searchQuery, searchResults, resultFocus]);

  function jumpToTrace(tid: string) {
    if (!tid) return;
    const el = document.querySelector(`[data-trace-id="${tid}"]`);
    if (el && "scrollIntoView" in el) {
      try {
        (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {
        (el as HTMLElement).scrollIntoView({ block: "center" });
      }
    }
    setJumpedTraceId(tid);
    setTimeout(() => {
      setJumpedTraceId((cur) => (cur === tid ? null : cur));
    }, 1000);
  }

  function requestJump(tid: string, bin: string) {
    if (!tid) return;
    setJumpErr(null);
    setJumpSeeking(true);
    setPendingJump({ tid, bin, requestedAt: Date.now(), tries: 0 });
    setActiveBin(bin);
    if (String(traceIdMemo || "") !== tid) {
      setTraceId(tid);
    }
  }

  useEffect(() => {
    if (!pendingJump) return;
    const tid = pendingJump.tid;
    const el = document.querySelector(`[data-trace-id="${tid}"]`);
    if (el) {
      jumpToTrace(tid);
      setPendingJump(null);
      setJumpSeeking(false);
      return;
    }

    const currentTrace = String(traceIdMemo || "");
    if (currentTrace !== tid) {
      setTraceId(tid);
      setPendingJump((p) =>
        p ? { ...p, tries: p.tries + 1 } : { tid, bin: pendingJump.bin, requestedAt: Date.now(), tries: 1 }
      );
      return;
    }

    setJumpErr("trace_not_loaded_in_view");
    setJumpSeeking(false);
    setPendingJump(null);
  }, [pendingJump, neighbors, traceIdMemo]);

  const traceIdMemo = useMemo(() => traceId, [traceId]);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
        }}
      >
        <div style={{ padding: 12, opacity: 0.75, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
          Recent / Search
        </div>
        <div style={{ padding: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            placeholder="provider_id (optional)"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              width: 220,
              color: "inherit",
            }}
          />
          <input
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="action_type (optional)"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              width: 220,
              color: "inherit",
            }}
          />
          <input
            value={filterVerdict}
            onChange={(e) => setFilterVerdict(e.target.value)}
            placeholder="policy_verdict (optional)"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              width: 220,
              color: "inherit",
            }}
          />
          <button
            onClick={loadRecent}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            Refresh list
          </button>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {recent.slice(0, 40).map((x, i) => {
            const tid = String(x?.trace_id || x?.id || "");
            const pid = String(x?.provider_id || "");
            const act = String(x?.action_type || "");
            const ver = String(x?.policy_verdict || "");
            const ts = x?.created_at ? fmtTs(x.created_at) : "";
            const life = String(x?.meta?.lifecycle || "");
            const job = String(x?.meta?.runner_job_id || "");

            return (
              <button
                key={tid || String(i)}
                onClick={() => setTraceId(tid)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  cursor: "pointer",
                }}
                title={tid}
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ ...pillStyle(), fontWeight: 700 }}>{act || "action"}</span>
                  {ver ? <span style={pillStyle()}>{ver}</span> : null}
                  {pid ? <span style={pillStyle()}>{pid}</span> : null}
                  {ts ? <span style={pillStyle()}>{ts}</span> : null}
                  {life ? <span style={pillStyle()}>{life}</span> : null}
                  {job ? <span style={pillStyle()}>job: {job}</span> : null}
                </div>
                <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>{tid}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={traceIdMemo}
          onChange={(e) => setTraceId(e.target.value.trim())}
          placeholder="trace_id"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            minWidth: 360,
            color: "inherit",
          }}
        />
        <input
          value={String(n)}
          onChange={(e) => setN(Number(e.target.value || 40))}
          placeholder="context N"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            width: 120,
            color: "inherit",
          }}
        />
        <button
          onClick={load}
          disabled={!traceIdMemo || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            cursor: "pointer",
            opacity: !traceIdMemo || loading ? 0.6 : 1,
          }}
        >
          Reload
        </button>
        {loading ? <span style={{ opacity: 0.75, alignSelf: "center" }}>Loading…</span> : null}
        {err ? (
          <span style={{ opacity: 0.85, color: "#ffb3b3", alignSelf: "center" }}>
            Error: {err}
          </span>
        ) : null}
      </div>

      {center ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ opacity: 0.75, marginBottom: 8 }}>Center trace</div>
          <RowCard row={center} highlight />
        </div>
      ) : null}

      {center ? (
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pillStyle()}>provider: {String(center?.provider_id || "(empty)")}</span>
          <span style={pillStyle()}>ts: {String(center?.ts || "(empty)")}</span>

          {neighborsLoading ? <span style={pillStyle()}>Neighbors: loading…</span> : null}
          {neighborsErr ? <span style={pillStyle()}>Neighbors error: {neighborsErr}</span> : null}

          <button
            disabled={!neighbors?.prev?.trace_id}
            onClick={() => {
              const tid = String(neighbors?.prev?.trace_id || "");
              if (tid) openTrace(tid);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              cursor: neighbors?.prev?.trace_id ? "pointer" : "not-allowed",
              opacity: neighbors?.prev?.trace_id ? 1 : 0.5,
            }}
          >
            ← Prev
          </button>

          <button
            disabled={!neighbors?.next?.trace_id}
            onClick={() => {
              const tid = String(neighbors?.next?.trace_id || "");
              if (tid) openTrace(tid);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              cursor: neighbors?.next?.trace_id ? "pointer" : "not-allowed",
              opacity: neighbors?.next?.trace_id ? 1 : 0.5,
            }}
          >
            Next →
          </button>

          {neighbors?.prev?.trace_id ? (
            <span style={pillStyle()}>
              prev: {String(neighbors.prev.trace_id)} ({String(neighbors.prev.ts)})
            </span>
          ) : null}
          {neighbors?.next?.trace_id ? (
            <span style={pillStyle()}>
              next: {String(neighbors.next.trace_id)} ({String(neighbors.next.ts)})
            </span>
          ) : null}

          {Array.isArray(neighbors?.timeline) && neighbors.timeline.length ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ opacity: 0.75, fontSize: 12 }}>Timeline strip</div>
              <div
                ref={stripRef}
                onPointerDown={(e) => {
                  const el = stripRef.current;
                  if (!el) return;
                  if (isTypingTarget((e as any).target)) return;
                  if (!neighbors || !Array.isArray((neighbors as any).timeline) || !(neighbors as any).timeline.length) {
                    return;
                  }

                  const timeline = (neighbors as any).timeline as any[];
                  const idx = idxFromClientX(el, (e as any).clientX ?? 0, timeline.length);
                  const m = timeline[idx];
                  if (m) {
                    setSelectedMini(m);
                    setStripTip(null);
                    hapticTick(idx);
                  }

                  setIsScrubbing(true);
                  try {
                    (e.currentTarget as any).setPointerCapture?.((e as any).pointerId);
                  } catch {}
                  e.preventDefault();
                }}
                onPointerMove={(e) => {
                  if (!isScrubbing) return;
                  const el = stripRef.current;
                  if (!el) return;
                  if (!neighbors || !Array.isArray((neighbors as any).timeline) || !(neighbors as any).timeline.length) {
                    return;
                  }

                  const timeline = (neighbors as any).timeline as any[];
                  const idx = idxFromClientX(el, (e as any).clientX ?? 0, timeline.length);
                  const m = timeline[idx];
                  if (m) {
                    setSelectedMini(m);
                    setStripTip(null);
                    hapticTick(idx);
                  }
                  e.preventDefault();
                }}
                onPointerUp={(e) => {
                  setIsScrubbing(false);
                  try {
                    (e.currentTarget as any).releasePointerCapture?.((e as any).pointerId);
                  } catch {}
                }}
                onPointerCancel={() => setIsScrubbing(false)}
                onWheel={(e) => {
                  if (isTypingTarget((e as any).target)) return;
                  if (!neighbors || !Array.isArray((neighbors as any).timeline) || !(neighbors as any).timeline.length) {
                    return;
                  }

                  const timeline = (neighbors as any).timeline as any[];
                  const centerIndex = Number((neighbors as any).center_index || 0);

                  const selectedId = String(selectedMini?.trace_id || "");
                  let idx = selectedId
                    ? timeline.findIndex((x) => String(x?.trace_id || "") === selectedId)
                    : -1;

                  if (idx < 0) idx = clamp(centerIndex, 0, timeline.length - 1);

                  const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
                  if (!dir) return;

                  e.preventDefault();

                  const step = (e as any).shiftKey ? 2 : 1;
                  const nextIdx = clamp(idx + dir * step, 0, timeline.length - 1);
                  const m = timeline[nextIdx];
                  if (m) {
                    setSelectedMini(m);
                    setStripTip(null);
                    hapticTick(nextIdx);
                  }
                }}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  touchAction: "none",
                  userSelect: "none",
                  cursor: isScrubbing ? "grabbing" : "grab",
                }}
              >
                {neighbors.timeline.map((m: any, i: number) => {
                  const tid = String(m?.trace_id || "");
                  const isCenter = Number(neighbors?.center_index || 0) === i;
                  const isSelected = String(selectedMini?.trace_id || "") === tid;
                  const marked = isMarked(tid);
                  const c = classifyMini(m);
                  const isJumped = String(jumpedTraceId || "") === tid;

                  return (
                    <span
                      key={tid || i}
                      data-trace-id={tid}
                      onMouseEnter={(e) => {
                        const a1 = oneLine(m?.action_type);
                        const a2 = line2(m);
                        setStripTip({
                          open: true,
                          x: (e as any).clientX ?? 0,
                          y: (e as any).clientY ?? 0,
                          a1,
                          a2,
                          trace_id: tid,
                        });
                      }}
                      onMouseMove={(e) => {
                        setStripTip((prev) =>
                          prev?.open
                            ? {
                                ...prev,
                                x: (e as any).clientX ?? prev.x,
                                y: (e as any).clientY ?? prev.y,
                              }
                            : prev
                        );
                      }}
                      onMouseLeave={() => setStripTip(null)}
                      onClick={(e) => {
                        setSelectedMini(m);
                        setStripTip(null);

                        if (neighbors && Array.isArray((neighbors as any).timeline)) {
                          const timeline = (neighbors as any).timeline as any[];
                          const idx = timeline.findIndex(
                            (x) => String(x?.trace_id || "") === String(m?.trace_id || "")
                          );
                          if (idx >= 0) hapticTick(idx);
                        }

                        if ((e as any)?.metaKey || (e as any)?.ctrlKey) {
                          if (tid) openTrace(tid);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (tid) openTrace(tid);
                      }}
                      style={dotStyle(c.cls, isCenter, isSelected, marked, isJumped)}
                    />
                  );
                })}
              </div>
              <div style={{ opacity: 0.6, fontSize: 12 }}>
                keys: ←/→ or J/L select (Shift×2) • K center • Enter/Space open • Esc/Shift+Space clear • M mark • Shift+M clear
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={pillStyle()}>bin: {activeBin || "(none)"}</span>
                <span style={pillStyle()}>markers: {markerIds.length}</span>
                <select
                  value={activeBin}
                  onChange={(e) => setActiveBin(String(e.target.value || ""))}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit",
                  }}
                >
                  {binsIndex.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const raw = window.prompt("New bin id (provider_id):", providerKey || "");
                    if (!raw) return;
                    const id = normalizeBinId(raw);
                    if (!id) return;
                    setBinsIndex((prev) => (prev.includes(id) ? prev : [id, ...prev]));
                    setActiveBin(id);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    cursor: "pointer",
                    opacity: 0.9,
                  }}
                >
                  + New Bin
                </button>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applySearch(searchQuery, true);
                    }
                  }}
                  placeholder="Search markers…"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit",
                    minWidth: 220,
                  }}
                />
                <button
                  onClick={() =>
                    setSearchMode((m) => (m === "marked" ? "visible" : "marked"))
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    cursor: "pointer",
                    opacity: 0.9,
                  }}
                >
                  {searchMode === "marked" ? "Marked only" : "All visible"}
                </button>
                <button
                  onClick={() => togglePinned(searchQuery)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    cursor: "pointer",
                    opacity: 0.9,
                  }}
                >
                  ⭐ Pin
                </button>
                <button
                  onClick={savePreset}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    cursor: "pointer",
                    opacity: 0.9,
                  }}
                >
                  💾 Save preset
                </button>
                {jumpSeeking ? <span style={pillStyle()}>Seeking…</span> : null}
                {jumpErr ? <span style={pillStyle()}>Jump: {jumpErr}</span> : null}
              </div>
              <div style={{ opacity: 0.65, fontSize: 11, marginTop: 6 }}>
                ⌘K focus · Esc clear · ↑↓ results · Enter Jump · ⌘Enter Open · J/O/P quick · / focus
              </div>
              {searchHints.length ? (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {searchHints.map((h) => (
                    <button
                      key={h}
                      onClick={() => applySearch(h, true)}
                      style={{
                        ...pillStyle(),
                        cursor: "pointer",
                        opacity: 0.95,
                      }}
                      title={`hint: ${h}`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              ) : null}
              {searchPresets.length ? (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {searchPresets.map((p) => (
                    <span
                      key={`${p.name}:${p.query}:${p.mode}`}
                      style={{ display: "inline-flex", gap: 6 }}
                    >
                      <button
                        onClick={() => applyPreset(p)}
                        title={`${p.mode} · ${p.query}`}
                        style={{ ...pillStyle(), cursor: "pointer" }}
                      >
                        {p.name}
                      </button>
                      <button
                        onClick={() => renamePreset(p)}
                        title="Rename preset"
                        style={{
                          padding: "2px 6px",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.04)",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => removePreset(p)}
                        title="Remove preset"
                        style={{
                          padding: "2px 6px",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.04)",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {pinnedQueries.length ? (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {pinnedQueries.map((q, i) => (
                    <button
                      key={q}
                      onClick={() => applySearch(q, true)}
                      style={{
                        ...pillStyle(),
                        cursor: "pointer",
                        boxShadow:
                          chipFocus?.list === "pinned" && chipFocus?.idx === i
                            ? "0 0 0 3px rgba(160,220,255,0.35)"
                            : undefined,
                      }}
                      title={q}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : null}
              {recentQueries.length ? (
                <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {recentQueries.map((q, i) => (
                    <span key={q} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <button
                        onClick={() => applySearch(q, true)}
                        style={{
                          ...pillStyle(),
                          cursor: "pointer",
                          boxShadow:
                            chipFocus?.list === "recent" && chipFocus?.idx === i
                              ? "0 0 0 3px rgba(160,220,255,0.35)"
                              : undefined,
                        }}
                        title={q}
                      >
                        {q}
                      </button>
                      <button
                        onClick={() => removeRecent(q)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.04)",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {searchResults.length ? (
                <div style={{ marginTop: 10, ...bannerStyle("ok") }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Search results</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {searchResults.map(({ bin, tid, info }, i) => {
                      const active = i === resultFocus;
                      return (
                      <div
                        key={`${bin}:${tid}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: active
                            ? "1px solid rgba(160,220,255,0.35)"
                            : "1px solid rgba(255,255,255,0.12)",
                          background: active ? "rgba(160,220,255,0.06)" : "rgba(255,255,255,0.04)",
                          boxShadow: active ? "0 0 0 3px rgba(160,220,255,0.18)" : undefined,
                        }}
                        onMouseEnter={() => setResultFocus(i)}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>
                            [{bin}] {info?.action ?? "(unknown action)"}
                          </div>
                          <div
                            style={{
                              opacity: 0.85,
                              fontSize: 12,
                              marginTop: 4,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {info?.line2 ?? tid}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => {
                              applySearch(searchQuery, true);
                              requestJump(tid, bin);
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,0.15)",
                              background: "rgba(255,255,255,0.08)",
                              cursor: "pointer",
                            }}
                          >
                            Jump
                          </button>
                          <button
                            onClick={() => {
                              applySearch(searchQuery, true);
                              openTrace(tid);
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,0.15)",
                              background: "rgba(255,255,255,0.06)",
                              cursor: "pointer",
                              opacity: 0.9,
                            }}
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              ) : null}
              {markerIds.length ? (
                <div style={{ marginTop: 12, ...bannerStyle("ok") }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Markers</div>
                    <button
                      onClick={() => clearMarkers()}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.06)",
                        cursor: "pointer",
                        opacity: 0.9,
                      }}
                    >
                      Clear all (Shift+M)
                    </button>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {markerItems.map(({ tid, info }) => {
                      const active = String(selectedMini?.trace_id || "") === tid;

                      return (
                        <div
                          key={tid}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                          }}
                        >
                          <div
                            onClick={() => {
                              if (info?.mini) setSelectedMini(info.mini);
                              else setSelectedMini({ trace_id: tid });
                              setStripTip(null);
                            }}
                            style={{ cursor: "pointer", minWidth: 0 }}
                            title={tid}
                          >
                            <div style={{ fontWeight: 700, fontSize: 12 }}>
                              {info?.action ?? "(unknown action)"} {active ? "• selected" : ""}
                            </div>
                            <div
                              style={{
                                opacity: 0.85,
                                fontSize: 12,
                                marginTop: 4,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {info?.line2 ?? tid}
                            </div>
                            {info?.ts ? (
                              <div style={{ opacity: 0.55, fontSize: 11, marginTop: 4 }}>
                                ts: {info.ts}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => openTrace(tid)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "rgba(255,255,255,0.08)",
                                cursor: "pointer",
                              }}
                            >
                              Open
                            </button>

                            <button
                              onClick={() => toggleMarker(tid)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "rgba(255,255,255,0.06)",
                                cursor: "pointer",
                                opacity: 0.9,
                              }}
                            >
                              Unmark
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {selectedMini ? (
                <div style={{ marginTop: 10, ...bannerStyle("ok") }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Selected (pinned)</div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={pillStyle()}>action: {oneLine(selectedMini?.action_type)}</span>
                    <span style={pillStyle()}>{line2(selectedMini)}</span>
                    <span style={pillStyle()}>trace: {oneLine(selectedMini?.trace_id)}</span>
                    <span style={pillStyle()}>
                      marker: {markers[String(selectedMini?.trace_id || "")] ? "on" : "off"} (M)
                    </span>

                    <button
                      onClick={() => {
                        const tid = String(selectedMini?.trace_id || "");
                        if (tid) openTrace(tid);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.08)",
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>

                    <button
                      onClick={() => {
                        const tid = String(selectedMini?.trace_id || "");
                        if (tid) toggleMarker(tid);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.06)",
                        cursor: "pointer",
                        opacity: 0.9,
                      }}
                    >
                      Toggle marker (M)
                    </button>

                    <button
                      onClick={() => {
                        setSelectedMini(null);
                        setStripTip(null);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.06)",
                        cursor: "pointer",
                        opacity: 0.9,
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
              {stripTip?.open ? (
                <div
                  style={{
                    ...tipStyle(),
                    left: stripTip.x + 12,
                    top: stripTip.y + 12,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{stripTip.a1}</div>
                  <div style={{ opacity: 0.85, fontSize: 12, marginTop: 4 }}>{stripTip.a2}</div>
                  <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6 }}>{stripTip.trace_id}</div>
                </div>
              ) : null}
              {selectedMini ? (
                <div style={{ marginTop: 10, ...bannerStyle("ok") }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Delta vs center</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={pillStyle()}>
                        selected: {String(selectedMini?.trace_id || "")}
                      </span>
                      <button
                        onClick={() => {
                          const tid = String(selectedMini?.trace_id || "");
                          if (tid) openTrace(tid);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.15)",
                          background: "rgba(255,255,255,0.08)",
                          cursor: "pointer",
                        }}
                      >
                        Open trace
                      </button>
                      <button
                        onClick={() => setSelectedMini(null)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.15)",
                          background: "rgba(255,255,255,0.06)",
                          cursor: "pointer",
                          opacity: 0.9,
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const cIdx = Number(neighbors?.center_index || 0);
                    const centerMini = Array.isArray(neighbors?.timeline)
                      ? neighbors.timeline[cIdx]
                      : null;
                    const d = deltaVsCenter(centerMini, selectedMini);

                    if (!d.length) {
                      return <div style={{ marginTop: 8, opacity: 0.9 }}>(no changes)</div>;
                    }

                    return (
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {d.map((x, i) => (
                          <div
                            key={i}
                            style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
                          >
                            <span style={pillStyle()}>field: {x.key}</span>
                            <span style={pillStyle()}>from: {x.from}</span>
                            <span style={pillStyle()}>to: {x.to}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {rc ? (
        <div style={{ marginTop: 16, ...bannerStyle(
          rc.cause === "policy_blocked" || rc.cause === "runner_failed" ? "bad" :
          rc.cause === "relogin_required" || rc.cause === "runner_timeout" ? "warn" : "ok"
        ) }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Most likely cause</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={pillStyle()}>class: {rc.cause}</span>
            {rc.evidence?.slice(0, 4).map((e: string, i: number) => (
              <span key={i} style={pillStyle()}>
                {e}
              </span>
            ))}
          </div>
          {rc.hints?.length ? (
            <div style={{ marginTop: 8, display: "grid", gap: 6, opacity: 0.95 }}>
              {rc.hints.map((h: string, i: number) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <span style={{ opacity: 0.7 }}>•</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {runnerJobId ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ opacity: 0.75, marginBottom: 8 }}>
            Runner chain • job_id: <span style={{ opacity: 0.9 }}>{runnerJobId}</span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {chainRows.map((row, i) => (
              <RowCard key={String(row?.trace_id || row?.id || i)} row={row} />
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <div style={{ opacity: 0.75, marginBottom: 8 }}>Window (context ±N)</div>
        <div style={{ display: "grid", gap: 10 }}>
          {windowRows.map((row, i) => {
            const id = String(row?.trace_id || row?.id || "");
            return <RowCard key={id || String(i)} row={row} highlight={id === traceIdMemo} />;
          })}
        </div>
      </div>

      <div style={{ marginTop: 16, opacity: 0.7, fontSize: 12 }}>
        Tip: this viewer is intentionally simple. Step 16 can add grouping by
        (trace_id chain / provider_id / time delta) and fast search.
      </div>
    </div>
  );
}
