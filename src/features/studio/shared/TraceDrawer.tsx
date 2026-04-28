"use client";

import { useEffect, useState } from "react";
import { TeleModal } from "@/components/tele";
import { TeleSecondaryButton } from "@/components/tele";
import { copyWithToast } from "@/ui/copy";

type TraceRecord = Record<string, any>;

export default function TraceDrawer(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  traceId: string;
  makerMode: boolean;
}) {
  const { open, onOpenChange, traceId, makerMode } = props;
  const [trace, setTrace] = useState<TraceRecord | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setStatus("loading");
    fetch(`/api/v1/traces/${encodeURIComponent(traceId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return;
        setTrace(json.trace ?? null);
        setStatus("idle");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [open, traceId]);

  function copyTrace() {
    if (!trace) return;
    copyWithToast(JSON.stringify(trace, null, 2));
  }

  return (
    <TeleModal open={open} onOpenChange={onOpenChange} title="Trace details">
      {status === "loading" && <div className="text-sm text-muted-foreground">Loading…</div>}
      {status === "error" && <div className="text-sm text-muted-foreground">Failed to load trace.</div>}
      {trace && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">trace_id: {traceId}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <TraceRow label="provider" value={trace.provider} />
            <TraceRow label="lane" value={trace.lane} />
            <TraceRow label="intent" value={trace.intent} />
            <TraceRow label="fallback_used" value={trace.fallback_used} />
            <TraceRow label="failures_count" value={trace.failures_count} />
            <TraceRow label="timeouts" value={trace.timeouts} />
            <TraceRow label="max_tokens" value={trace.max_tokens} />
            <TraceRow label="issues_count" value={trace.issues_count} />
            <TraceRow label="patch_bytes" value={trace.patch_bytes} />
            <TraceRow label="duration_sec" value={trace.duration_sec} />
          </div>

          {makerMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <TraceRow label="validators_mp4_exists" value={trace.validators_mp4_exists} />
              <TraceRow label="validators_duration_ok" value={trace.validators_duration_ok} />
              <TraceRow label="validators_aspect_9x16" value={trace.validators_aspect_9x16} />
              <TraceRow label="validators_audio_present" value={trace.validators_audio_present} />
            </div>
          )}

          <TeleSecondaryButton onClick={copyTrace} className="px-4">
            Copy trace json
          </TeleSecondaryButton>
        </div>
      )}
    </TeleModal>
  );
}

function TraceRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{String(value ?? "—")}</span>
    </div>
  );
}
