import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { useForgeWorkflows } from "../hooks/useForge";
import type { ForgeWorkflow } from "../types/forge";

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ForgeReportScreen() {
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
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  const isComplete = workflow.current_stage === "complete";
  const hasError = !!workflow.error;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Link
          to={`/forge/workflow/${id}`}
          className="p-2 rounded hover:bg-primary/20"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Report
        </h1>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          {isComplete ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : hasError ? (
            <XCircle className="w-5 h-5 text-red-400" />
          ) : (
            <Clock className="w-5 h-5 text-yellow-400" />
          )}
          <span className="font-semibold">
            {isComplete ? "Completed" : hasError ? "Failed" : "In Progress"}
          </span>
        </div>
        <p className="text-sm text-muted mb-2">
          Workflow: {workflow.workflow_id}
        </p>
        <p className="text-sm text-muted">
          Created: {formatTime(workflow.created_at)}
        </p>
        <p className="text-sm text-muted">
          Updated: {formatTime(workflow.updated_at)}
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Task</h2>
        <p className="text-sm whitespace-pre-wrap">{workflow.task}</p>
      </div>

      {workflow.stages?.review?.result && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Review Result</h2>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-background p-2 rounded">
            {workflow.stages.review.result}
          </pre>
        </div>
      )}

      {workflow.stages?.verify?.result && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Verification Result</h2>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-background p-2 rounded">
            {workflow.stages.verify.result}
          </pre>
        </div>
      )}

      {hasError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <h2 className="font-semibold text-red-400 mb-2">Error</h2>
          <p className="text-red-300">{workflow.error}</p>
        </div>
      )}

      <div className="flex gap-2 text-sm">
        <Link
          to={`/forge/timeline/${id}`}
          className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30"
        >
          Timeline
        </Link>
      </div>
    </div>
  );
}