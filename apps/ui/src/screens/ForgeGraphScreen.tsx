import { Link } from "react-router-dom";
import { useForgeWorkflows, useForgeGraph } from "../hooks/useForge";
import { GitBranch, ArrowRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "border-border",
  running: "border-yellow-500 bg-yellow-500/20",
  completed: "border-green-500 bg-green-500/20",
  failed: "border-red-500 bg-red-500/20",
};

export function ForgeGraphScreen() {
  const { workflows } = useForgeWorkflows();
  const { graphs, loading } = useForgeGraph();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const activeWorkflows = workflows.filter((w) => w.current_stage !== "complete");

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GitBranch className="w-6 h-6" />
          Task Graph
        </h1>
        <Link to="/forge" className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30">
          Dashboard
        </Link>
      </div>

      {!graphs.length ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <GitBranch className="w-12 h-12 text-muted" />
          <p className="text-muted">No task graphs yet</p>
          <p className="text-sm text-muted">Parallel execution creates task graphs</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {graphs.map((graph) => (
            <div
              key={graph.graph_id}
              className="p-4 bg-card border border-border rounded-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-sm">{graph.graph_id}</p>
                <p className="text-xs text-muted">{graph.tasks.length} tasks</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {graph.tasks.map((task, idx) => (
                  <div
                    key={task.task_id}
                    className="flex items-center gap-1"
                  >
                    <div
                      className={`px-2 py-1 rounded border ${
                        STATUS_COLORS[task.status] ?? "border-border"
                      }`}
                    >
                      <span className="text-sm font-mono">{task.task_id.slice(0, 8)}</span>
                    </div>
                    {task.parent_ids.length > 0 && (
                      <div className="flex gap-1 ml-1">
                        {task.parent_ids.slice(0, 2).map((pid) => (
                          <span
                            key={pid}
                            className="text-xs text-muted"
                          >
                            ←{pid.slice(0, 4)}
                          </span>
                        ))}
                      </div>
                    )}
                    {idx < graph.tasks.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-muted mx-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeWorkflows.length > 0 && (
        <div className="border-t border-border pt-4">
          <h2 className="text-lg font-semibold mb-3">Active Workflows</h2>
          <div className="flex flex-col gap-2">
            {activeWorkflows.slice(0, 5).map((wf) => (
              <Link
                key={wf.workflow_id}
                to={`/forge/workflow/${wf.workflow_id}`}
                className="flex items-center gap-2 p-2 bg-card border border-border rounded hover:bg-primary/10"
              >
                <GitBranch className="w-4 h-4 text-muted" />
                <span className="font-mono text-sm">{wf.workflow_id.slice(0, 12)}</span>
                <span className="text-muted text-sm">{wf.current_stage}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}