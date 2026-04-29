import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Play, Pause, AlertTriangle, Clock, ArrowLeft } from "lucide-react";
import { useForgeWorkflows } from "../hooks/useForge";
import type { ForgeWorkflow, WorkflowStageRecord } from "../types/forge";

const STAGES = ["intent", "analysis", "plan", "review", "apply", "verify", "complete"];

const STAGE_ICONS: Record<string, string> = {
  pending: "⏳",
  running: "🔄",
  completed: "✅",
  failed: "❌",
  skipped: "⏭️",
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStageStatus(stages: Record<string, WorkflowStageRecord> | undefined, stage: string): string {
  return stages?.[stage]?.status ?? "pending";
}

export function ForgeWorkflowScreen() {
  const { id } = useParams<{ id: string }>();
  const { workflows } = useForgeWorkflows();
  const [workflow, setWorkflow] = useState<ForgeWorkflow | null>(null);

  useEffect(() => {
    if (id && workflows.length) {
      const found = workflows.find((w) => w.workflow_id === id);
      setWorkflow(found ?? null);
    }
  }, [id, workflows]);

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Clock className="w-12 h-12 text-muted animate-pulse" />
        <p className="text-muted">Loading workflow...</p>
      </div>
    );
  }

  const currentIdx = STAGES.indexOf(workflow.current_stage);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Link
          to="/forge"
          className="p-2 rounded hover:bg-primary/20"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold truncate">
            {workflow.title || workflow.task.slice(0, 50)}
          </h1>
          <p className="text-sm text-muted">
            {workflow.account_label} · Created {formatTime(workflow.created_at)}
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted">Progress</span>
          <span className="font-mono text-sm">
            {currentIdx + 1} / {STAGES.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {STAGES.map((stage, idx) => {
            const status = getStageStatus(workflow.stages, stage);
            const isCurrent = idx === currentIdx;
            const isPast = idx < currentIdx;
            return (
              <div
                key={stage}
                className={`flex-1 h-2 rounded-sm ${
                  status === "completed"
                    ? "bg-green-500"
                    : status === "failed"
                    ? "bg-red-500"
                    : status === "running"
                    ? "bg-yellow-500"
                    : "bg-border"
                }`}
                style={{ opacity: isPast || isCurrent ? 1 : 0.3 }}
                title={`${stage}: ${status}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted">
          {STAGES.slice(0, currentIdx + 1).map((stage) => (
            <span key={stage}>{STAGE_ICONS[getStageStatus(workflow.stages, stage)]}</span>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-3 border-b border-border">
          <h2 className="font-semibold">Stages</h2>
        </div>
        <div className="flex flex-col">
          {STAGES.map((stage: string) => {
            const record = workflow.stages?.[stage] as WorkflowStageRecord | undefined;
            const status = record?.status ?? "pending";
            const isCurrent = stage === workflow.current_stage;
            return (
              <div
                key={stage}
                className={`flex items-center justify-between p-3 border-b border-border last:border-0 ${
                  isCurrent ? "bg-primary/10" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span>{STAGE_ICONS[status]}</span>
                  <div>
                    <p className={`font-medium ${isCurrent ? "text-primary" : ""}`}>
                      {stage}
                    </p>
                    {record?.result && (
                      <p className="text-xs text-muted truncate max-w-[200px]">
                        {record.result}
                      </p>
                    )}
                    {record?.error && (
                      <p className="text-xs text-red-400 truncate max-w-[200px]">
                        {record.error}
                      </p>
                    )}
                  </div>
                </div>
                {isCurrent && (
                  <div className="flex gap-2">
                    <button className="p-2 rounded bg-primary/20 hover:bg-primary/30" title="Next">
                      <Play className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded bg-yellow-500/20 hover:bg-yellow-500/30" title="Pause">
                      <Pause className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {workflow.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Error</span>
          </div>
          <p className="text-red-300">{workflow.error}</p>
        </div>
      )}

      <div className="flex gap-2 text-sm">
        <Link
          to={`/forge/timeline/${workflow.workflow_id}`}
          className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30"
        >
          Timeline
        </Link>
        <Link
          to={`/forge/report/${workflow.workflow_id}`}
          className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30"
        >
          Report
        </Link>
      </div>
    </div>
  );
}