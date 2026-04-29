import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import { useForgeDashboard } from "../hooks/useForge";
import type { ForgeWorkflow } from "../types/forge";

const STAGE_ICONS: Record<string, string> = {
  intent: "🎯",
  analysis: "🔍",
  plan: "📋",
  review: "👁️",
  apply: "🔧",
  verify: "✅",
  complete: "🏁",
  pending: "⏳",
  running: "🔄",
  failed: "❌",
  completed: "✅",
  skipped: "⏭️",
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStage(stage: string) {
  return STAGE_ICONS[stage] ?? "•";
}

export function ForgeDashboardScreen() {
  const { dashboard, loading, error, refresh } = useForgeDashboard();

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-red-400">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-primary/20 rounded hover:bg-primary/30"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = dashboard?.stats ?? {
    totalWorkflows: 0,
    activeWorkflows: 0,
    stalledWorkflows: 0,
    awaitingApproval: 0,
    totalTasks: 0,
    totalCheckpoints: 0,
    pendingHeals: 0,
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" />
          Sigma Forge
        </h1>
        <button
          onClick={refresh}
          className="p-2 rounded hover:bg-primary/20"
          title="Refresh"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted mb-1">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Active</span>
          </div>
          <p className="text-2xl font-bold">{stats.activeWorkflows}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Pending Review</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">
            {stats.awaitingApproval}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Stalled</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.stalledWorkflows}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold">{stats.totalWorkflows}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-muted" />
          <span className="text-muted">Tasks:</span>
          <span className="font-mono">{stats.totalTasks}</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-muted" />
          <span className="text-muted">Checkpoints:</span>
          <span className="font-mono">{stats.totalCheckpoints}</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted" />
          <span className="text-muted">Pending Heals:</span>
          <span className="font-mono">{stats.pendingHeals}</span>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h2 className="text-lg font-semibold mb-3">Recent Workflows</h2>
        {!dashboard?.recentWorkflows?.length ? (
          <p className="text-muted text-center py-8">
            No workflows yet. Start one via Telegram.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {dashboard.recentWorkflows.map((wf: ForgeWorkflow) => (
              <Link
                key={wf.workflow_id}
                to={`/forge/workflow/${wf.workflow_id}`}
                className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{formatStage(wf.current_stage)}</span>
                  <div>
                    <p className="font-medium truncate max-w-[200px] md:max-w-[300px]">
                      {wf.title || wf.task.slice(0, 50)}
                    </p>
                    <p className="text-xs text-muted">
                      {wf.account_label} · {formatTime(wf.updated_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted">Stage:</span>
                  <span className="font-mono">{wf.current_stage}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 text-sm">
        <Link
          to="/forge/tasks"
          className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30"
        >
          Tasks
        </Link>
        <Link
          to="/forge/graph"
          className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30"
        >
          Graph
        </Link>
      </div>
    </div>
  );
}