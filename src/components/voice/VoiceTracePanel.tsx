"use client";

import React, { useEffect, useMemo, useState } from "react";

type VoiceTraceRow = {
  id: string;
  created_at: string;
  route: "say" | "speak";
  preset: string | null;
  speaker: string | null;
  tts_ms: number | null;
  dsp_ms: number | null;
  rtf: number | null;
  chunks: number | null;
  failover_used: boolean;
  meta: Record<string, any>;
};

function fmtMs(v: number | null) {
  if (v === null || v === undefined) return "—";
  if (v < 1000) return `${Math.round(v)}ms`;
  return `${(v / 1000).toFixed(2)}s`;
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function VoiceTracePanel() {
  const [rows, setRows] = useState<VoiceTraceRow[]>([]);
  const [selected, setSelected] = useState<VoiceTraceRow | null>(null);
  const [explain, setExplain] = useState<any>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totalShown = rows.length;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/voice/traces?limit=60", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "fetch_failed");
      setRows(j.traces || []);
    } catch (e: any) {
      setErr(e?.message || "fetch_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadExplain(id: string) {
    setExplainLoading(true);
    try {
      const r = await fetch(`/api/voice/traces/${encodeURIComponent(id)}/explain`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "explain_failed");
      setExplain(j.explain);
    } catch {
      setExplain(null);
    } finally {
      setExplainLoading(false);
    }
  }

  const selectedMeta = useMemo(() => {
    if (!selected) return "";
    try {
      return JSON.stringify(selected.meta ?? {}, null, 2);
    } catch {
      return "";
    }
  }, [selected]);

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-white/90">Voice Traces</div>
          <div className="text-xs text-white/60">
            Последние {totalShown || 0} • route/preset/speaker • failover • rtf
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
            disabled={loading}
            title="Обновить список трасс"
          >
            {loading ? "Обновляю…" : "Обновить"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Ошибка: {err}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {rows.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSelected(t);
              setExplain(null);
            }}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
            title="Открыть трассу"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                {t.route}
              </span>
              {t.failover_used ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                  failover
                </span>
              ) : null}
              {t.preset ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  preset: {t.preset}
                </span>
              ) : null}
              {t.speaker ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  speaker: {t.speaker}
                </span>
              ) : null}
              {t.rtf !== null && t.rtf !== undefined ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  rtf: {Number(t.rtf).toFixed(3)}
                </span>
              ) : null}
              {t.chunks ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  chunks: {t.chunks}
                </span>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-white/60">
              <span>tts: {fmtMs(t.tts_ms)}</span>
              <span>dsp: {fmtMs(t.dsp_ms)}</span>
              <span>{fmtDate(t.created_at)}</span>
              <span className="text-white/50">id: {t.id.slice(0, 18)}…</span>
            </div>
          </button>
        ))}

        {rows.length === 0 && !loading && !err ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/60">
            Трасс пока нет. Проверь: TELEGPT_VOICE_TRACE_DB=1 и SUPABASE_* env.
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-white/90">Trace detail</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(selected.id);
                  } catch {}
                }}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                title="Скопировать trace-id"
              >
                Copy trace-id
              </button>
              <button
                onClick={() => selected && loadExplain(selected.id)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
                disabled={!selected || explainLoading}
                title="Показать объяснение (TRACE_LAYER)"
              >
                {explainLoading ? "Explain…" : "Explain"}
              </button>
              <button
                onClick={() => {
                  setSelected(null);
                  setExplain(null);
                }}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                title="Закрыть"
              >
                Закрыть
              </button>
            </div>
          </div>

          <div className="mt-2 text-xs text-white/70">
            <div className="text-white/60">trace-id</div>
            <div className="mt-1 break-all rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-[11px]">
              {selected.id}
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-white/70">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                route: {selected.route}
              </span>
              {selected.preset ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  preset: {selected.preset}
                </span>
              ) : null}
              {selected.speaker ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  speaker: {selected.speaker}
                </span>
              ) : null}
              {selected.failover_used ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                  failover_used
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/60">
              <span>tts: {fmtMs(selected.tts_ms)}</span>
              <span>dsp: {fmtMs(selected.dsp_ms)}</span>
              <span>
                rtf:{" "}
                {selected.rtf !== null && selected.rtf !== undefined
                  ? Number(selected.rtf).toFixed(3)
                  : "—"}
              </span>
              <span>chunks: {selected.chunks ?? "—"}</span>
              <span>{fmtDate(selected.created_at)}</span>
            </div>

            <div>
              <div className="text-white/60">meta</div>
              <pre className="mt-1 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-white/70">
{selectedMeta || "{}"}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {explain ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-sm font-medium text-white/90">TRACE_LAYER</div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/80">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
              why: {explain?.summary?.why || "—"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
              route: {explain?.summary?.route || "—"}
            </span>
            {explain?.summary?.preset ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                preset: {explain.summary.preset}
              </span>
            ) : null}
            {explain?.summary?.speaker ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                speaker: {explain.summary.speaker}
              </span>
            ) : null}
            {explain?.summary?.failover_used ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                failover_used
              </span>
            ) : null}
          </div>

          {explain?.env ? (
            <div className="mt-3">
              <div className="text-xs text-white/60">env</div>
              <pre className="mt-1 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-white/70">
{JSON.stringify(explain.env, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
