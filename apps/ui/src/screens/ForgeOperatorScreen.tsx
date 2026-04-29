import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Server,
  Terminal,
  ListChecks,
  Play,
  Pause,
  FileText,
  RotateCcw,
  Shield,
  Mic,
  Wifi,
} from "lucide-react";
import { useForgeDashboard, useForgeAction, useForgePatches } from "../hooks/useForge";
import { useEffect, useState } from "react";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getStatusIcon(status: string) {
  switch (status) {
    case "running":
      return <Activity className="w-4 h-4 text-green-400 animate-pulse" />;
    case "stalled":
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    case "pending":
      return <Clock className="w-4 h-4 text-yellow-400" />;
    default:
      return <CheckCircle className="w-4 h-4 text-muted" />;
  }
}

export function ForgeOperatorScreen() {
  const { dashboard, refresh } = useForgeDashboard();
  const { patches } = useForgePatches();
  const { execute, loading: actionLoading } = useForgeAction();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({
    forge: "loading",
    mcp: "loading",
    kilo: "loading",
  });

  useEffect(() => {
    setStatus({
      forge: (dashboard?.stats?.activeWorkflows ?? 0) > 0 ? "running" : "offline",
      mcp: "ready",
      kilo: "ready",
    });
  }, [dashboard]);

  const handleAction = async (action: string, workflowId?: string) => {
    await execute(action, { workflow_id: workflowId });
  };

  const activeWorkflows = dashboard?.recentWorkflows?.filter(
    (w) => w.current_stage !== "complete"
  ) ?? [];
  const stalledWorkflows = activeWorkflows.filter(
    (w) => w.error || w.stages?.[w.current_stage]?.status === "failed"
  );
  const pendingPatches = patches.filter((p) => p.status === "pending");

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Server className="w-6 h-6 text-primary" />
          Operator Console
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="p-2 rounded hover:bg-primary/20"
            title="Refresh"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <Link to="/forge" className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-xs">Forge</span>
          </div>
          <div className={`flex items-center gap-2 text-lg font-bold ${
            status.forge === "running" ? "text-green-400" :
            status.forge === "offline" ? "text-red-400" :
            "text-yellow-400"
          }`}>
            {status.forge === "running" ? (
              <Activity className="w-5 h-5 animate-pulse" />
            ) : status.forge === "offline" ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
            <span className="uppercase text-sm">{status.forge}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted mb-1">
            <Terminal className="w-4 h-4" />
            <span className="text-xs">Kilo</span>
          </div>
          <div className="flex items-center gap-2 text-lg font-bold text-green-400">
            <Mic className="w-5 h-5" />
            <span className="uppercase text-sm">{status.kilo}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted mb-1">
            <Terminal className="w-4 h-4" />
            <span className="text-xs">MCP</span>
          </div>
          <div className="flex items-center gap-2 text-lg font-bold text-green-400">
            <Wifi className="w-5 h-5" />
            <span className="uppercase text-sm">{status.mcp}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted mb-1">
            <ListChecks className="w-4 h-4" />
            <span className="text-xs">Active</span>
          </div>
          <p className="text-2xl font-bold">
            {dashboard?.stats?.activeWorkflows ?? 0}
          </p>
        </div>
      </div>

      {stalledWorkflows.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-red-300">Stalled ({stalledWorkflows.length})</span>
          </div>
          <div className="flex flex-col">
            {stalledWorkflows.slice(0, 3).map((wf) => (
              <div
                key={wf.workflow_id}
                className="flex items-center justify-between p-3 border-b border-red-500/10 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm truncate">
                    {wf.workflow_id.slice(0, 16)}
                  </p>
                  <p className="text-xs text-red-400 truncate">
                    {wf.error || wf.stages?.[wf.current_stage]?.error}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleAction("forge_resume", wf.workflow_id)}
                    disabled={actionLoading}
                    className="p-1.5 rounded bg-green-500/20 hover:bg-green-500/30"
                    title="Resume"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <Link
                    to={`/forge/report/${wf.workflow_id}`}
                    className="p-1.5 rounded bg-primary/20 hover:bg-primary/30"
                    title="Report"
                  >
                    <FileText className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Active Workflows ({activeWorkflows.length})
            </h2>
          </div>
          <div className="flex flex-col max-h-64 overflow-y-auto">
            {activeWorkflows.length === 0 ? (
              <p className="p-4 text-muted text-center text-sm">
                No active workflows
              </p>
            ) : (
              activeWorkflows.slice(0, 10).map((wf) => (
                <div
                  key={wf.workflow_id}
                  onClick={() => setSelectedWorkflow(wf.workflow_id)}
                  className={`flex items-center justify-between p-3 border-b border-border last:border-0 cursor-pointer hover:bg-primary/10 ${
                    selectedWorkflow === wf.workflow_id ? "bg-primary/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(wf.error ? "stalled" : "running")}
                    <div className="min-w-0">
                      <p className="font-mono text-sm truncate">
                        {wf.workflow_id.slice(0, 12)}
                      </p>
                      <p className="text-xs text-muted">
                        {wf.current_stage} · {formatTime(wf.updated_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Link
                      to={`/forge/workflow/${wf.workflow_id}`}
                      className="p-1 rounded hover:bg-primary/20"
                      title="View"
                    >
                      <Terminal className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Pending Patches ({pendingPatches.length})
            </h2>
          </div>
          <div className="flex flex-col max-h-64 overflow-y-auto">
            {pendingPatches.length === 0 ? (
              <p className="p-4 text-muted text-center text-sm">No pending patches</p>
            ) : (
              pendingPatches.slice(0, 10).map((patch) => (
                <div
                  key={patch.plan_id}
                  className="flex items-center justify-between p-3 border-b border-border last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm truncate">
                      {patch.plan_id.slice(0, 16)}
                    </p>
                    <p className="text-xs text-muted">
                      {patch.files?.length ?? 0} files · {patch.risk_level}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Link
                      to={`/forge/diff/${patch.plan_id}`}
                      className="p-1 rounded bg-primary/20 hover:bg-primary/30"
                      title="Review Diff"
                    >
                      <FileText className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedWorkflow && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Quick Actions</h3>
            <button
              onClick={() => setSelectedWorkflow(null)}
              className="text-xs text-muted hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAction("forge_next", selectedWorkflow)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 rounded disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span className="text-sm">Next</span>
            </button>
            <button
              onClick={() => handleAction("forge_pause", selectedWorkflow)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 rounded disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              <span className="text-sm">Pause</span>
            </button>
            <button
              onClick={() => handleAction("forge_validate", selectedWorkflow)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded disabled:opacity-50"
            >
              <Shield className="w-4 h-4" />
              <span className="text-sm">Validate</span>
            </button>
            <Link
              to={`/forge/report/${selectedWorkflow}`}
              className="flex items-center gap-2 px-3 py-2 bg-primary/20 hover:bg-primary/30 rounded"
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm">Report</span>
            </Link>
            <Link
              to={`/forge/workflow/${selectedWorkflow}`}
              className="flex items-center gap-2 px-3 py-2 bg-primary/20 hover:bg-primary/30 rounded"
            >
              <Terminal className="w-4 h-4" />
              <span className="text-sm">Details</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}