"use client";

import { useEffect, useRef, useState } from "react";
import { getActiveSurfaceSnapshot, getSurfaceSwitches, jumpTopActive } from "@/ui/activeSurface";

type Snap = ReturnType<typeof getActiveSurfaceSnapshot>;

function isMakerEnabled() {
  try {
    return localStorage.getItem("telegpt_maker") === "1";
  } catch {
    return false;
  }
}

export default function ActiveSurfaceDevOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [snap, setSnap] = useState<Snap>(null);
  const [switches, setSwitches] = useState<ReturnType<typeof getSurfaceSwitches>>([]);
  const [showProgrammatic, setShowProgrammatic] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setEnabled(isMakerEnabled());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        const next = !isMakerEnabled();
        try {
          localStorage.setItem("telegpt_maker", next ? "1" : "0");
        } catch {}
        setEnabled(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= 125) {
        last = t;
        setSnap(getActiveSurfaceSnapshot());
        setSwitches(getSurfaceSwitches());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  if (!enabled) return null;

  const title = snap ? `${snap.type} • ${snap.id}` : "no active surface";
  const sourceIds = Array.from(new Set(switches.map((s) => s.sourceId).filter(Boolean))) as string[];
  sourceIds.sort();

  let visibleSwitches = showProgrammatic
    ? switches
    : switches.filter((s) => s.reason !== "programmatic");
  if (sourceFilter !== "all") {
    visibleSwitches = visibleSwitches.filter((s) => s.sourceId === sourceFilter);
  }

  function buildBugPayload() {
    return {
      kind: "ASC_BUG_REPORT",
      ts: Date.now(),
      active: snap,
      filters: { showProgrammatic, sourceFilter },
      switches: visibleSwitches,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "—",
      commitSha: process.env.NEXT_PUBLIC_GIT_SHA ?? "—",
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? "—",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "—",
      path: typeof location !== "undefined" ? location.pathname : "—",
    };
  }

  return (
    <div
      className="fixed bottom-3 left-3 z-[9999] w-[320px] rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-3 text-xs text-white shadow-2xl"
      style={{ WebkitBackdropFilter: "blur(16px)" as any }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold tracking-wide">{title}</div>
        <button
          className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          onClick={() => {
            try {
              localStorage.setItem("telegpt_maker", "0");
            } catch {}
            setEnabled(false);
          }}
        >
          Hide
        </button>
      </div>

      <div className="mt-2 space-y-1 opacity-90">
        <div>
          scrollTop: <span className="font-mono">{snap?.scrollTop ?? "—"}</span>
        </div>
        <div>
          registered: <span className="font-mono">{snap?.registeredCount ?? "—"}</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          onClick={() => jumpTopActive()}
        >
          JumpTop
        </button>

        <button
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          onClick={() => {
            try {
              navigator.clipboard.writeText(JSON.stringify(snap, null, 2));
            } catch {}
          }}
        >
          Copy
        </button>
      </div>

      <div className="mt-3 space-y-1 opacity-80">
        <div className="text-[11px] uppercase tracking-wide opacity-70">
          {showProgrammatic ? "Last 10" : "Last 10 (filtered)"}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <select
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2 py-[2px] text-[11px] outline-none"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">All sources</option>
            {sourceIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>

          <button
            className="rounded-xl border border-white/10 bg-white/5 px-2 py-[2px] text-[11px] hover:bg-white/10"
            onClick={() => setShowProgrammatic((v) => !v)}
          >
            {showProgrammatic ? "Hide programmatic" : "Show programmatic"}
          </button>
        </div>
        <div className="space-y-1">
          {visibleSwitches.length === 0 && <div className="opacity-60">—</div>}
          {visibleSwitches.map((s) => (
            <div key={s.seq} className="flex items-center justify-between gap-2">
              <span className="font-mono opacity-80">
                {new Date(s.t).toLocaleTimeString()}
              </span>
              <span className="opacity-80">{s.reason}</span>
              <span className="opacity-80">{s.type}</span>
              <span className="font-mono">{s.id}</span>
              <span className="truncate opacity-70">{s.sourceId ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          onClick={() => {
            const payload = {
              kind: "ASC_SWITCHES",
              ts: Date.now(),
              active: snap,
              filters: { showProgrammatic, sourceFilter },
              switches: visibleSwitches,
            };
            try {
              navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            } catch {}
          }}
        >
          Copy switches
        </button>

        <button
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          onClick={() => {
            const payload = {
              kind: "ASC_TRACE_EXPORT",
              ts: Date.now(),
              active: snap,
              filters: { showProgrammatic, sourceFilter },
              switches: visibleSwitches,
            };

            try {
              const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const stamp = new Date().toISOString().replace(/[:.]/g, "-");
              a.href = url;
              a.download = `telegpt-asc-trace-${stamp}.json`;
              a.click();
              URL.revokeObjectURL(url);
            } catch {}
          }}
        >
          Export JSON
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          onClick={() => {
            const payload = buildBugPayload();
            const stamp = new Date(payload.ts).toISOString();
            const lines = [
              "### Bug report (ASC trace attached)",
              "",
              `- Time: ${stamp}`,
              `- Version: ${payload.appVersion}`,
              `- Commit: ${payload.commitSha}`,
              `- Build: ${payload.buildTime}`,
              `- Path: ${payload.path}`,
              `- Active: ${payload.active ? `${payload.active.type}:${payload.active.id}` : "—"}`,
              `- Filters: source=${payload.filters.sourceFilter}, programmatic=${payload.filters.showProgrammatic}`,
              "",
              "Steps to reproduce:",
              "1) …",
              "2) …",
              "3) …",
              "",
              "Expected:",
              "- …",
              "",
              "Actual:",
              "- …",
              "",
              "ASC Trace JSON:",
              "```json",
              JSON.stringify(payload, null, 2),
              "```",
            ].join("\n");

            try {
              navigator.clipboard.writeText(lines);
              setCopied(true);
              if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
              copiedTimerRef.current = window.setTimeout(() => setCopied(false), 900) as any;
            } catch {}
          }}
        >
          {copied ? "Copied" : "Attach"}
        </button>
        <button
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          onClick={() => {
            const payload = buildBugPayload();
            const stamp = new Date(payload.ts).toISOString();

            const report = [
              "### Bug report (ASC trace attached)",
              "",
              `- Time: ${stamp}`,
              `- Version: ${payload.appVersion}`,
              `- Commit: ${payload.commitSha}`,
              `- Build: ${payload.buildTime}`,
              `- Path: ${payload.path}`,
              `- Active: ${payload.active ? `${payload.active.type}:${payload.active.id}` : "—"}`,
              `- Filters: source=${payload.filters.sourceFilter}, programmatic=${payload.filters.showProgrammatic}`,
              "",
              "Steps to reproduce:",
              "1) …",
              "2) …",
              "3) …",
              "",
              "Expected:",
              "- …",
              "",
              "Actual:",
              "- …",
              "",
              "ASC Trace JSON:",
              "```json",
              JSON.stringify(payload, null, 2),
              "```",
            ].join("\n");

            try {
              const handoff = {
                kind: "MISSION_HANDOFF_BUG_REPORT_V1",
                ts: Date.now(),
                report,
                payload,
              };
              sessionStorage.setItem("telegpt_mission_handoff", JSON.stringify(handoff));
            } catch {}

            window.open("/mission/intel?tab=bugs&handoff=1", "_blank", "noopener,noreferrer");
          }}
        >
          Open Mission Control
        </button>
      </div>

      <div className="mt-2 opacity-60">Toggle: Alt+Shift+D</div>
    </div>
  );
}
