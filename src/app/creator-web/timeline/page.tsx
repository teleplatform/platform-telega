"use client";

import { useEffect, useMemo, useState } from "react";

function fmt(ts?: number | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function pill() {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
  } as const;
}

function openTrace(id: string) {
  window.open(`/creator-web/trace?trace_id=${encodeURIComponent(id)}`, "_blank", "noopener,noreferrer");
}

function SessionCard({
  s,
  highlight,
  onDiff,
  onRetry,
  diffSummary,
}: {
  s: any;
  highlight?: boolean;
  onDiff?: (provider_id: string, failed_session_id: string) => void;
  onRetry?: (provider_id: string, failed_session_id: string) => void;
  diffSummary?: any | null;
}) {
  const status = String(s?.status || "open");
  const started = fmt(s?.started_at);
  const ended = fmt(s?.ended_at);
  const provider = String(s?.provider_id || "");
  const reason = String(s?.reason || "");
  const loginTrace = String(s?.login_trace_id || "");
  const endTrace =
    status === "ok"
      ? String(s?.health_ok_trace_id || "")
      : String(s?.events?.[s?.events?.length - 1]?.trace_id || "");
  const reloginHits =
    Number(s?.relogin_required_hits || 0) ||
    Number(s?.action_counts?.relogin_required || 0) ||
    Number(s?.lifecycle_counts?.relogin_required || 0);

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
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ ...pill(), fontWeight: 700 }}>{provider}</span>
        <span style={pill()}>{status}</span>
        <span style={pill()}>{started}</span>
        <span style={pill()}>{ended}</span>
        {reason ? <span style={pill()}>{reason}</span> : null}
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {reloginHits > 0 ? <span style={pill()}>RELOGIN REQUIRED ×{reloginHits}</span> : null}
        {loginTrace ? (
          <button
            onClick={() => openTrace(loginTrace)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            Open login trace
          </button>
        ) : null}
        {endTrace ? (
          <button
            onClick={() => openTrace(endTrace)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            Open end trace
          </button>
        ) : null}
        {s?.events?.length ? (
          <button
            onClick={() => openTrace(String(s.events[s.events.length - 1]?.trace_id || ""))}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            Open last trace
          </button>
        ) : null}
        {status === "failed" && onRetry ? (
          <button
            onClick={() => onRetry(provider, String(s?.session_id || ""))}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        ) : null}
        {status === "failed" && onDiff ? (
          <button
            onClick={() => onDiff(provider, String(s?.session_id || ""))}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            Compare vs last OK
          </button>
        ) : null}
      </div>

      {diffSummary ? (
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={pill()}>events Δ: {String(diffSummary?.events?.delta ?? "")}</span>
          <span style={pill()}>duration_ms Δ: {String(diffSummary?.duration_ms?.delta ?? "")}</span>
          <span style={pill()}>
            relogin Δ: {String(diffSummary?.relogin_required_hits?.delta ?? "")}
          </span>
          {diffSummary?.verdicts?.[0] ? (
            <span style={pill()}>
              verdict Δ: {String(diffSummary.verdicts[0]?.key || "")} (
              {String(diffSummary.verdicts[0]?.delta || 0)})
            </span>
          ) : null}
          {diffSummary?.lifecycles?.[0] ? (
            <span style={pill()}>
              lifecycle Δ: {String(diffSummary.lifecycles[0]?.key || "")} (
              {String(diffSummary.lifecycles[0]?.delta || 0)})
            </span>
          ) : null}
          {diffSummary?.actions?.[0] ? (
            <span style={pill()}>
              action Δ: {String(diffSummary.actions[0]?.key || "")} (
              {String(diffSummary.actions[0]?.delta || 0)})
            </span>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        {(s?.events || []).slice(0, 30).map((ev: any, i: number) => (
          <div
            key={String(ev?.trace_id || i)}
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              opacity: 0.85,
            }}
          >
            <span style={{ ...pill(), fontWeight: 700 }}>{String(ev?.action_type || "")}</span>
            {ev?.verdict ? <span style={pill()}>{String(ev.verdict)}</span> : null}
            {ev?.ts ? <span style={pill()}>{fmt(Number(ev.ts))}</span> : null}
            {ev?.lifecycle ? <span style={pill()}>{String(ev.lifecycle)}</span> : null}
            {ev?.runner_job_id ? <span style={pill()}>job: {String(ev.runner_job_id)}</span> : null}
            {ev?.trace_id ? (
              <button
                onClick={() => openTrace(String(ev.trace_id))}
                style={{
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                Open trace
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CreatorWebTimelinePage() {
  const [providerId, setProviderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [openSessions, setOpenSessions] = useState<any[]>([]);
  const [orphans, setOrphans] = useState<any[]>([]);
  const [diffCache, setDiffCache] = useState<Record<string, any>>({});
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryErr, setRetryErr] = useState<string | null>(null);
  const [retryOk, setRetryOk] = useState<any | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffErr, setDiffErr] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (providerId) qs.set("provider_id", providerId);
      const r = await fetch(`/api/creator-web/timeline?${qs.toString()}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "fetch_failed");
      setSessions(Array.isArray(j.sessions) ? j.sessions : []);
      setOpenSessions(Array.isArray(j.open_sessions) ? j.open_sessions : []);
      setOrphans(Array.isArray(j.orphans) ? j.orphans : []);
    } catch (e: any) {
      setErr(e?.message || "fetch_failed");
      setSessions([]);
      setOpenSessions([]);
      setOrphans([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDiff(provider_id: string, failed_session_id: string) {
    setDiffOpen(true);
    setDiffLoading(true);
    setDiffErr(null);
    setDiffData(null);
    try {
      const qs = new URLSearchParams();
      qs.set("provider_id", provider_id);
      qs.set("failed_session_id", failed_session_id);
      const r = await fetch(`/api/creator-web/session/diff?${qs.toString()}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "diff_failed");
      setDiffData(j);
      if (j?.diff) {
        setDiffCache((m) => ({ ...m, [failed_session_id]: j.diff }));
      }
    } catch (e: any) {
      setDiffErr(String(e?.message || e));
    } finally {
      setDiffLoading(false);
    }
  }

  async function retrySession(provider_id: string, failed_session_id: string) {
    setRetryLoading(true);
    setRetryErr(null);
    setRetryOk(null);
    try {
      const r = await fetch(`/api/creator-web/session/retry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider_id, failed_session_id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "retry_failed");
      setRetryOk(j);
    } catch (e: any) {
      setRetryErr(String(e?.message || e));
    } finally {
      setRetryLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  const providerIdMemo = useMemo(() => providerId, [providerId]);
  const sortedSessions = useMemo(() => {
    return sessions.slice(0, 40).sort((a: any, b: any) => {
      const ar =
        Number(a?.relogin_required_hits || 0) ||
        Number(a?.action_counts?.relogin_required || 0) ||
        Number(a?.lifecycle_counts?.relogin_required || 0);
      const br =
        Number(b?.relogin_required_hits || 0) ||
        Number(b?.action_counts?.relogin_required || 0) ||
        Number(b?.lifecycle_counts?.relogin_required || 0);
      const af = String(a?.status || "") === "failed";
      const bf = String(b?.status || "") === "failed";
      if (af !== bf) return af ? -1 : 1;
      if (ar !== br) return br - ar;
      return 0;
    });
  }, [sessions]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={providerIdMemo}
          onChange={(e) => setProviderId(e.target.value.trim())}
          placeholder="provider_id (optional)"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            minWidth: 280,
            color: "inherit",
          }}
        />
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
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

      {openSessions.length ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ opacity: 0.75, marginBottom: 8 }}>Open sessions</div>
          <div style={{ display: "grid", gap: 12 }}>
            {openSessions.map((s, i) => (
              <SessionCard
                key={String(s?.session_id || i)}
                s={s}
                highlight
                onDiff={loadDiff}
                onRetry={retrySession}
                diffSummary={diffCache[String(s?.session_id || "")] || null}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <div style={{ opacity: 0.75, marginBottom: 8 }}>Recent sessions</div>
        <div style={{ display: "grid", gap: 12 }}>
          {sortedSessions.map((s, i) => (
            <SessionCard
              key={String(s?.session_id || i)}
              s={s}
              onDiff={loadDiff}
              onRetry={retrySession}
              diffSummary={diffCache[String(s?.session_id || "")] || null}
            />
          ))}
        </div>
      </div>

      {orphans.length ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ opacity: 0.75, marginBottom: 8 }}>
            Orphans (events without an open session in the scanned window)
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {orphans.slice(-30).map((ev: any, i: number) => (
              <button
                key={String(ev?.trace_id || i)}
                onClick={() => ev?.trace_id && openTrace(String(ev.trace_id))}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ ...pill(), fontWeight: 700 }}>{String(ev?.action_type || "")}</span>
                  {ev?.verdict ? <span style={pill()}>{String(ev.verdict)}</span> : null}
                  {ev?.ts ? <span style={pill()}>{fmt(Number(ev.ts))}</span> : null}
                  {ev?.lifecycle ? <span style={pill()}>{String(ev.lifecycle)}</span> : null}
                  {ev?.runner_job_id ? <span style={pill()}>job: {String(ev.runner_job_id)}</span> : null}
                </div>
                <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                  {String(ev?.trace_id || "")}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {diffOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setDiffOpen(false)}
        >
          <div
            style={{
              width: "min(920px, 96vw)",
              maxHeight: "90vh",
              overflow: "auto",
              background: "rgba(20,20,24,0.98)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 650 }}>Session Diff</div>
              <button
                onClick={() => setDiffOpen(false)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            {diffLoading ? <div style={{ marginTop: 12, opacity: 0.8 }}>Loading…</div> : null}
            {diffErr ? (
              <div style={{ marginTop: 12, color: "#ffb3b3" }}>Error: {diffErr}</div>
            ) : null}

            {diffData?.ok ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={pill()}>provider: {String(diffData?.diff?.provider_id || "")}</span>
                  <span style={pill()}>ok: {String(diffData?.diff?.ok_session_id || "")}</span>
                  <span style={pill()}>failed: {String(diffData?.diff?.failed_session_id || "")}</span>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={pill()}>events Δ: {String(diffData?.diff?.events?.delta ?? "")}</span>
                  <span style={pill()}>
                    duration_ms Δ: {String(diffData?.diff?.duration_ms?.delta ?? "")}
                  </span>
                  <span style={pill()}>
                    relogin_required Δ:{" "}
                    {String(diffData?.diff?.relogin_required_hits?.delta ?? "")}
                  </span>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {Array.isArray(diffData?.diff?.verdicts) && diffData.diff.verdicts[0] ? (
                    <span style={pill()}>
                      top verdict Δ: {String(diffData.diff.verdicts[0]?.key || "")} (
                      {String(diffData.diff.verdicts[0]?.delta || 0)})
                    </span>
                  ) : null}
                  {Array.isArray(diffData?.diff?.lifecycles) && diffData.diff.lifecycles[0] ? (
                    <span style={pill()}>
                      top lifecycle Δ: {String(diffData.diff.lifecycles[0]?.key || "")} (
                      {String(diffData.diff.lifecycles[0]?.delta || 0)})
                    </span>
                  ) : null}
                  {Array.isArray(diffData?.diff?.actions) && diffData.diff.actions[0] ? (
                    <span style={pill()}>
                      top action Δ: {String(diffData.diff.actions[0]?.key || "")} (
                      {String(diffData.diff.actions[0]?.delta || 0)})
                    </span>
                  ) : null}
                </div>

                <div style={{ marginTop: 12, opacity: 0.8, fontSize: 12 }}>Verdicts changes</div>
                <pre
                  style={{
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    whiteSpace: "pre-wrap",
                  }}
                >
{JSON.stringify(diffData?.diff?.verdicts || [], null, 2)}
                </pre>

                <div style={{ marginTop: 12, opacity: 0.8, fontSize: 12 }}>Lifecycle changes</div>
                <pre
                  style={{
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    whiteSpace: "pre-wrap",
                  }}
                >
{JSON.stringify(diffData?.diff?.lifecycles || [], null, 2)}
                </pre>

                <div style={{ marginTop: 12, opacity: 0.8, fontSize: 12 }}>Action changes</div>
                <pre
                  style={{
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    whiteSpace: "pre-wrap",
                  }}
                >
{JSON.stringify(diffData?.diff?.actions || [], null, 2)}
                </pre>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {diffData?.ok_session?.end_trace_id ? (
                    <button
                      onClick={() => openTrace(String(diffData.ok_session.end_trace_id))}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.08)",
                        cursor: "pointer",
                      }}
                    >
                      Open OK end trace
                    </button>
                  ) : null}
                  {diffData?.failed_session?.end_trace_id ? (
                    <button
                      onClick={() => openTrace(String(diffData.failed_session.end_trace_id))}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.08)",
                        cursor: "pointer",
                      }}
                    >
                      Open failed end trace
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {retryLoading ? <span style={pill()}>Retry: running…</span> : null}
        {retryErr ? <span style={pill()}>Retry error: {retryErr}</span> : null}
        {retryOk?.ok ? (
          <span style={pill()}>Retry started: {String(retryOk.runner_job_id || "")}</span>
        ) : null}
      </div>
    </div>
  );
}
