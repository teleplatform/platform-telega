"use client";

import { useEffect, useState } from "react";
import {
  TeleChip,
  TeleGlassPanel,
  TeleListItem,
  TelePrimaryButton,
  TeleSecondaryButton,
  TeleModal,
} from "@/components/tele";
import TraceDrawer from "../shared/TraceDrawer";

type TaskItem = {
  task_id: string;
  status: string;
  visibility: string;
  title: string;
  created_at: number;
  updated_at: number;
  heartbeat_at?: number | null;
  artifacts_count?: number;
};

type TaskDetails = {
  id: string;
  status: string;
  runner_id?: string | null;
  heartbeat_at?: number | null;
  blocked_reason?: string | null;
  version?: number;
  task_json?: string | null;
  result_json?: string | null;
  source_trace_id?: string | null;
};

type Artifact = {
  id: string;
  name: string;
  mime: string;
  path: string;
  bytes: number;
};

type Filter = "all" | "active" | "done" | "blocked";

export default function ForgePanel({ makerMode }: { makerMode: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<TaskItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [selected, setSelected] = useState<string | null>(null);
  const [runOnceSummary, setRunOnceSummary] = useState<string | null>(null);

  async function loadTasks() {
    setStatus("loading");
    try {
      const res = await fetch("/api/v1/tasks?limit=50");
      const json = await res.json();
      setItems(json.items ?? []);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  const filtered = items.filter((t) => {
    if (filter === "all") return true;
    if (filter === "active") return t.status === "queued" || t.status === "running";
    return t.status === filter;
  });

  const hasQueued = items.some((t) => t.status === "queued");

  return (
    <TeleGlassPanel className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">Forge Tasks</div>
        <div className="flex items-center gap-2">
          {makerMode && (
            <TeleSecondaryButton
              onClick={async () => {
                const res = await fetch("/api/v1/forge/run-once", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ maker_mode: true }),
                });
                const json = await res.json().catch(() => ({}));
                if (res.ok) {
                  setRunOnceSummary(
                    `processed=${json.processed ?? 0}, completed=${json.completed ?? 0}, errors=${json.errors ?? 0}`
                  );
                } else {
                  setRunOnceSummary("Run once failed");
                }
                await loadTasks();
              }}
              className="px-4"
              disabled={!hasQueued}
            >
              Run once
            </TeleSecondaryButton>
          )}
          <TelePrimaryButton onClick={loadTasks} className="px-4">
            Refresh
          </TelePrimaryButton>
        </div>
      </div>
      {runOnceSummary && (
        <div className="text-xs text-muted-foreground">{runOnceSummary}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["all", "active", "done", "blocked"] as Filter[]).map((f) => (
          <TeleChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>

      {status === "error" && (
        <div className="text-sm text-muted-foreground">Failed to load tasks.</div>
      )}
      {status === "loading" && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}

      <div className="space-y-2">
        {filtered.map((t) => (
          <TeleListItem
            key={t.task_id}
            title={`${t.title} • ${statusLabel(t.status)}`}
            subtitle={`artifacts: ${t.artifacts_count ?? 0} • age: ${ageFrom(t.updated_at)} • heartbeat: ${heartbeatLabel(t)}`}
            right="Open"
            onClick={() => setSelected(t.task_id)}
          />
        ))}
        {!filtered.length && (
          <div className="text-sm text-muted-foreground">No tasks yet.</div>
        )}
      </div>

      {selected && (
        <TaskDrawer
          taskId={selected}
          open={Boolean(selected)}
          onOpenChange={() => setSelected(null)}
          makerMode={makerMode}
        />
      )}
    </TeleGlassPanel>
  );
}

function TaskDrawer(props: {
  taskId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  makerMode: boolean;
}) {
  const { taskId, open, onOpenChange, makerMode } = props;
  const [details, setDetails] = useState<TaskDetails | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [traceOpen, setTraceOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`/api/v1/tasks/${encodeURIComponent(taskId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return;
        setDetails(json);
      });
    fetch(`/api/v1/tasks/${encodeURIComponent(taskId)}/artifacts`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return;
        setArtifacts(json.items ?? []);
      });
    return () => {
      alive = false;
    };
  }, [open, taskId]);

  const payload = safeJson(details?.task_json);

  return (
    <TeleModal open={open} onOpenChange={onOpenChange} title="Task details">
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          status: {details?.status ?? "—"}
        </div>
        {details?.blocked_reason && (
          <div className="text-sm text-muted-foreground">
            blocked_reason: {details.blocked_reason}
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          heartbeat: {details?.heartbeat_at ? new Date(details.heartbeat_at).toLocaleString() : "—"}
        </div>
        {payload?.kind && (
          <div className="text-sm text-muted-foreground">kind: {payload.kind}</div>
        )}
        {payload?.prompt && (
          <div className="text-sm text-muted-foreground">
            prompt: {String(payload.prompt).slice(0, 200)}
          </div>
        )}

        {details?.source_trace_id && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            trace: {details.source_trace_id}
            <button
              type="button"
              className="text-white/70 hover:text-white"
              onClick={() => setTraceOpen(true)}
            >
              Details
            </button>
          </div>
        )}

        <ArtifactsViewer artifacts={artifacts} />

        {details?.source_trace_id && (
          <TraceDrawer
            open={traceOpen}
            onOpenChange={setTraceOpen}
            traceId={details.source_trace_id}
            makerMode={makerMode}
          />
        )}
      </div>
    </TeleModal>
  );
}

function ArtifactsViewer({ artifacts }: { artifacts: Artifact[] }) {
  const [active, setActive] = useState<Artifact | null>(null);
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (!active) return;
    if (isTextArtifact(active)) {
      fetch(`/api/v1/tasks/artifacts/${encodeURIComponent(active.id)}`)
        .then((res) => res.text())
        .then((t) => setText(t));
    } else {
      setText("");
    }
  }, [active]);

  if (!artifacts.length) {
    return <div className="text-sm text-muted-foreground">No artifacts.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">Artifacts</div>
      <div className="flex flex-wrap gap-2">
        {artifacts.map((a) => (
          <TeleChip
            key={a.id}
            label={a.name}
            active={active?.id === a.id}
            onClick={() => setActive(a)}
          />
        ))}
      </div>
      {active && (
        <div className="tele-glass rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-muted-foreground">{active.name}</div>
            <a
              className="text-xs text-white/70 hover:text-white"
              href={`/api/v1/tasks/artifacts/${active.id}`}
              download
            >
              Download
            </a>
          </div>
          {isImage(active) && (
            <img src={`/api/v1/tasks/artifacts/${active.id}`} alt={active.name} />
          )}
          {isVideo(active) && (
            <video controls className="w-full">
              <source src={`/api/v1/tasks/artifacts/${active.id}`} />
            </video>
          )}
          {isTextArtifact(active) && (
            <pre className="text-xs whitespace-pre-wrap">{text}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function isTextArtifact(a: Artifact) {
  return (
    a.mime.startsWith("text/") ||
    a.name.endsWith(".md") ||
    a.name.endsWith(".diff") ||
    a.name.endsWith(".json") ||
    a.name.endsWith(".txt")
  );
}

function isImage(a: Artifact) {
  return a.mime.startsWith("image/");
}

function isVideo(a: Artifact) {
  return a.mime.startsWith("video/");
}

function safeJson(raw?: string | null) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function statusLabel(status?: string) {
  return status ?? "unknown";
}

function ageFrom(ts: number | undefined) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function heartbeatLabel(t: TaskItem) {
  if (t.status !== "running") return "—";
  if (!t.heartbeat_at) return "stale";
  const diff = Date.now() - t.heartbeat_at;
  return diff <= 45_000 ? "alive" : "stale";
}
