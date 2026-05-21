import { appendEvidenceRecord, getEvidenceByTrace } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";

export interface TraceLineage {
  trace_id: string;
  parent_trace_id?: string;
  replay_of?: string;
  children: string[];
  replayed_by: string[];
  replay_targets: string[];
  linked_traces: Array<{
    trace_id: string;
    relation: string;
  }>;
}

export async function linkReplayTraces(
  originalTraceId: string,
  replayTraceId: string,
): Promise<void> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(originalTraceId, "trace_lineage_linked"),
    trace_id: originalTraceId,
    job_id: originalTraceId,
    type: "trace_lineage_linked",
    timestamp: new Date().toISOString(),
    linked_trace_ids: [replayTraceId],
    relation: "replayed_by",
    payload: {
      original_trace_id: originalTraceId,
      replay_trace_id: replayTraceId,
      direction: "original_to_replay",
    },
  });

  await appendEvidenceRecord({
    evidence_id: hashTraceId(replayTraceId, "trace_lineage_linked"),
    trace_id: replayTraceId,
    job_id: replayTraceId,
    type: "trace_lineage_linked",
    timestamp: new Date().toISOString(),
    linked_trace_ids: [originalTraceId],
    relation: "replay_of",
    payload: {
      original_trace_id: originalTraceId,
      replay_trace_id: replayTraceId,
      direction: "replay_to_original",
    },
  });
}

export function getTraceLineage(traceId: string): TraceLineage {
  const records = getEvidenceByTrace(traceId);

  const firstRecord = records[0];
  const parent_trace_id = firstRecord?.parent_trace_id;
  const replay_of = firstRecord?.replay_of;

  const children: string[] = [];
  const replayed_by: string[] = [];
  const replay_targets: string[] = [];

  for (const r of records) {
    if (r.type === "trace_lineage_linked") {
      const ids = r.linked_trace_ids || [];
      if (r.relation === "replayed_by") {
        replayed_by.push(...ids);
      }
      if (r.relation === "replay_of") {
        children.push(...ids);
      }
    }
    if (r.parent_trace_id && r.parent_trace_id !== traceId) {
      children.push(r.parent_trace_id);
    }
    if (r.replay_of && r.replay_of !== traceId) {
      children.push(r.replay_of);
    }
  }

  const linkedTraces = [...new Set([...children, ...replayed_by])].map((id) => ({
    trace_id: id,
    relation: replayed_by.includes(id) ? "replayed_by" : "child",
  }));

  return {
    trace_id: traceId,
    parent_trace_id,
    replay_of,
    children: [...new Set(children)],
    replayed_by: [...new Set(replayed_by)],
    replay_targets: [...new Set(replay_targets)],
    linked_traces: linkedTraces,
  };
}
