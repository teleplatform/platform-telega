import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Clock, User } from "lucide-react";
import { useForgeWorkflows, useForgeTimelines } from "../hooks/useForge";
import type { ForgeTimeline } from "../types/forge";

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ForgeTimelineScreen() {
  const { id } = useParams<{ id: string }>();
  const { workflows } = useForgeWorkflows();
  const { timelines } = useForgeTimelines(id);
  const [workflow, setWorkflow] = useState<any>(null);

  useEffect(() => {
    if (id && workflows.length) {
      const found = workflows.find((w) => w.workflow_id === id);
      setWorkflow(found ?? null);
    }
  }, [id, workflows]);

  const wfTimelines = timelines.filter((t) => t.workflow_id === id);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Link
          to={`/forge/workflow/${id}`}
          className="p-2 rounded hover:bg-primary/20"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Timeline</h1>
          {workflow && (
            <p className="text-sm text-muted truncate">
              {workflow.title || workflow.task.slice(0, 40)}
            </p>
          )}
        </div>
      </div>

      {!wfTimelines.length ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Clock className="w-12 h-12 text-muted" />
          <p className="text-muted">No timeline events yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {wfTimelines.map((event, idx) => (
            <div
              key={event.timeline_id || idx}
              className="flex gap-3 p-3 bg-card border border-border rounded-lg"
            >
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-primary" />
                {idx < wfTimelines.length - 1 && (
                  <div className="w-0.5 flex-1 bg-border mt-1" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{event.event}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-primary/20 rounded">
                    {event.stage}
                  </span>
                </div>
                <p className="text-sm text-muted mb-2">{event.detail}</p>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {event.actor}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ForgeTimelineListScreen() {
  const { timelines, loading } = useForgeTimelines();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const grouped = timelines.reduce((acc, t) => {
    if (!acc[t.workflow_id]) acc[t.workflow_id] = [];
    acc[t.workflow_id].push(t);
    return acc;
  }, {} as Record<string, ForgeTimeline[]>);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Timeline Events</h1>
        <Link to="/forge" className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30">
          Dashboard
        </Link>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-muted text-center py-12">No timeline events yet</p>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([workflowId, events]) => {
            const latest = events[0];
            return (
              <Link
                key={workflowId}
                to={`/forge/timeline/${workflowId}`}
                className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-primary/10"
              >
                <div>
                  <p className="font-medium">{workflowId}</p>
                  <p className="text-sm text-muted">{events.length} events</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{latest?.event}</p>
                  <p className="text-xs text-muted">
                    {latest && formatTime(latest.timestamp)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}