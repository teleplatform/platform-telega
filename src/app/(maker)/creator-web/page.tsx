"use client";

import { useEffect, useRef, useState } from "react";

type ProviderRow = {
  id: string;
  display_name: string;
  source_url: string;
  enabled: boolean;
  maker_only: boolean;
  policy_id: string;
  status: "normal" | "slow" | "paused" | "blocked";
  paused_until: number;
  actions_10m: number;
  actions_day: number;
  relogin_required: boolean;
  relogin_reason: string;
  relogin_at: number;
};

type ProvidersResponse = {
  ok: boolean;
  kill_switch: boolean;
  providers: ProviderRow[];
};

function fmtPausedUntil(ts: number) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function CreatorWebPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [killSwitch, setKillSwitch] = useState(false);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [healthMap, setHealthMap] = useState<Record<string, { ok: boolean; reason?: string }>>({});
  const [runnerOk, setRunnerOk] = useState<boolean | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const jobIdRef = useRef<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/creator-web/providers", { cache: "no-store" });
      const j = (await r.json()) as ProvidersResponse;
      if (!r.ok || !j?.ok) throw new Error("fetch_failed");
      setKillSwitch(Boolean(j.kill_switch));
      setProviders(j.providers || []);
    } catch (e: any) {
      setError(e?.message || "fetch_failed");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSelection() {
    try {
      const r = await fetch("/api/creator-web/selection", { cache: "no-store" });
      const j = await r.json();
      setSelectedProvider(j?.selected_provider ?? null);
    } catch {
      // ignore
    }
  }

  async function selectProvider(provider_id: string) {
    try {
      await fetch("/api/creator-web/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider_id }),
      });
    } finally {
      await refreshSelection();
    }
  }

  async function runHealth(provider_id: string) {
    const adapterId = provider_id;
    if (adapterId !== "deepseek_web" && adapterId !== "qwen_web" && adapterId !== "chatgpt_web") {
      setHealthMap((m) => ({ ...m, [provider_id]: { ok: false, reason: "no_adapter" } }));
      return;
    }
    const r = await fetch(`/api/creator-web/health?provider=${encodeURIComponent(adapterId)}`, {
      cache: "no-store",
    });
    const j = await r.json();
    setHealthMap((m) => ({
      ...m,
      [provider_id]: { ok: Boolean(j?.ok), reason: j?.reason || "" },
    }));
  }

  async function openLastTrace(provider_id: string) {
    const r = await fetch(
      `/api/creator-web/trace/last?provider_id=${encodeURIComponent(provider_id)}`,
      { cache: "no-store" }
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok || !j?.last_trace_id) {
      setError("no_last_trace");
      return;
    }
    window.open(
      `/creator-web/trace?trace_id=${encodeURIComponent(String(j.last_trace_id))}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function refreshRunner() {
    try {
      const r = await fetch("/api/local-runner/ping", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      setRunnerOk(Boolean(j?.ok));
    } catch {
      setRunnerOk(false);
    }
  }

  async function startHeadfulLogin(provider_id: string) {
    setJobLoading(true);
    setJob(null);

    const r = await fetch("/api/local-runner/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "web:login", provider: provider_id }),
    });
    const j = await r.json().catch(() => ({}));
    setJobLoading(false);

    if (r.ok && j?.ok && j?.job_id) {
      const id = String(j.job_id);
      setJobId(id);
      jobIdRef.current = id;
    } else {
      setJobId(null);
      jobIdRef.current = null;
      setJob({ status: "failed", logs: [JSON.stringify(j)] });
    }
  }

  async function refreshJob(id: string) {
    const r = await fetch(`/api/local-runner/jobs/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (j?.ok && j?.job) {
      setJob(j.job);
    } else {
      setJob({ status: "failed", logs: [JSON.stringify(j)] });
    }
  }

  async function toggleKillSwitch(next: boolean) {
    try {
      const r = await fetch("/api/creator-web/kill-switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error("toggle_failed");
      setKillSwitch(Boolean(j.kill_switch));
    } catch (e: any) {
      setError(e?.message || "toggle_failed");
    }
  }

  useEffect(() => {
    load();
    refreshSelection();
    refreshRunner();
    const t = setInterval(() => {
      load();
      refreshSelection();
      refreshRunner();
      if (jobIdRef.current) {
        refreshJob(jobIdRef.current);
      }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    jobIdRef.current = jobId;
    refreshJob(jobId);
    const t = setInterval(() => refreshJob(jobId), 1500);
    return () => clearInterval(t);
  }, [jobId]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Creator Web Providers</h1>
        <span style={{ opacity: 0.6, fontSize: 12 }}>Maker-only</span>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={() => load()}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
          }}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>

        <button
          onClick={() => toggleKillSwitch(!killSwitch)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: killSwitch
              ? "1px solid rgba(255,80,80,0.4)"
              : "1px solid rgba(255,255,255,0.15)",
            background: killSwitch ? "rgba(255,80,80,0.15)" : "rgba(255,255,255,0.06)",
          }}
        >
          Kill Switch: {killSwitch ? "ON" : "OFF"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,0,0,0.3)",
            background: "rgba(255,0,0,0.08)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {providers.map((p) => {
          const paused = p.paused_until ? fmtPausedUntil(p.paused_until) : "";
          return (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 0.9fr 0.6fr 0.4fr",
                gap: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                padding: 14,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div>
                <div style={{ fontWeight: 650 }}>{p.display_name}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>{p.id}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>{p.source_url}</div>
                <div style={{ opacity: 0.65, fontSize: 12 }}>policy: {p.policy_id}</div>
              </div>

              <div>
                <div>
                  status: <b>{p.status}</b>
                </div>
                {paused ? (
                  <div style={{ opacity: 0.75, fontSize: 12 }}>paused until: {paused}</div>
                ) : null}
                {p.relogin_required ? (
                  <div style={{ marginTop: 6 }}>
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,160,80,0.35)",
                        background: "rgba(255,160,80,0.10)",
                        fontSize: 12,
                        display: "inline-block",
                      }}
                    >
                      Re-login required
                    </span>
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                      {p.relogin_reason || "session expired"}
                    </div>
                  </div>
                ) : null}
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  actions_10m: {p.actions_10m} · actions_day: {p.actions_day}
                </div>
              </div>

              <div style={{ opacity: 0.85 }}>
                <div>enabled: {String(p.enabled)}</div>
                <div>maker_only: {String(p.maker_only)}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
                  {selectedProvider === p.id ? (
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(80, 255, 160, 0.35)",
                        background: "rgba(80, 255, 160, 0.12)",
                        fontSize: 12,
                      }}
                    >
                      Selected
                    </span>
                  ) : null}

                  {healthMap[p.id] ? (
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.06)",
                        fontSize: 12,
                      }}
                    >
                      {healthMap[p.id].ok
                        ? "Health: OK"
                        : `Health: FAIL (${healthMap[p.id].reason || "re-login"})`}
                    </span>
                  ) : null}

                  {p.id === "qwen_web" || p.id === "deepseek_web" || p.id === "chatgpt_web" ? (
                    <button
                      onClick={() => runHealth(p.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.08)",
                        cursor: "pointer",
                      }}
                    >
                      Health
                    </button>
                  ) : null}

                  <button
                    onClick={() => startHeadfulLogin(p.id)}
                    disabled={runnerOk !== true || jobLoading}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: runnerOk === true ? "rgba(255,255,255,0.08)" : "rgba(255,80,80,0.12)",
                      cursor: runnerOk === true ? "pointer" : "not-allowed",
                      opacity: runnerOk === true ? 1 : 0.6,
                    }}
                    title={
                      runnerOk === true
                        ? "Open headful browser for manual login"
                        : "Local runnerd is not running"
                    }
                  >
                    Login (Headful)
                  </button>

                  <button
                    onClick={() => openLastTrace(p.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.08)",
                      cursor: "pointer",
                    }}
                  >
                    Open last trace
                  </button>

                  {p.relogin_required ? (
                    <a
                      href={p.source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,160,80,0.35)",
                        background: "rgba(255,160,80,0.10)",
                        textDecoration: "none",
                      }}
                      title="Login manually in browser, then run Health again"
                    >
                      Re-login
                    </a>
                  ) : null}

                  <button
                    onClick={() => selectProvider(p.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.08)",
                      cursor: "pointer",
                    }}
                  >
                    Select
                  </button>

                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.08)",
                      textDecoration: "none",
                    }}
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            padding: 12,
            opacity: 0.75,
            borderBottom: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          Local Runner
          <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.8 }}>
            {runnerOk === null ? "checking…" : runnerOk ? "OK" : "OFFLINE"}
          </span>
        </div>

        <div style={{ padding: 12 }}>
          {jobId ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>job: {jobId}</div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No active job.</div>
          )}

          {job ? (
            <>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                status: <b>{String(job.status)}</b>
                {job.exit_code !== null && job.exit_code !== undefined ? (
                  <span style={{ marginLeft: 8, opacity: 0.75 }}>
                    exit: {String(job.exit_code)}
                  </span>
                ) : null}
              </div>

              <pre
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  maxHeight: 260,
                  overflow: "auto",
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                }}
              >
{Array.isArray(job.logs) ? job.logs.join("") : String(job.logs || "")}
              </pre>
            </>
          ) : null}

          {!runnerOk ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Start it: <code style={{ opacity: 0.9 }}>pnpm tele-gpt:runnerd</code>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 16, opacity: 0.7, fontSize: 12 }}>
        Note: Providers are never auto-selected. You must explicitly choose them for a session.
      </div>
    </div>
  );
}
