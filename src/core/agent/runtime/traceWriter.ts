
// Trace Writer - Trace Layer Minimum Compliant

import { randomUUID } from "crypto";
import { createHash } from "crypto";
import type { TraceEvent, AgentSessionId } from "../../../types/agentRuntime.js";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { DEFAULT_LIMITS } from "./runtimeLimits.js";
import { tracePolicyChecked, tracePolicyDenied } from "./policyTrace.js";

export interface TraceWriter {
  writeEvent(event: TraceEvent): Promise<void>;
  closeTrace(sid: AgentSessionId, status: "completed" | "failed" | "terminated"): Promise<void>;
  getTracePath(sid: AgentSessionId): string;
}

export class JsonlTraceWriter implements TraceWriter {
  private tracesDir: string;
  private traces = new Map<AgentSessionId, {
    events: TraceEvent[];
    lastHash: string;
  }>();
  private traceCounts = new Map<AgentSessionId, number>();

  constructor(tracesDir: string = "./evidence") {
    this.tracesDir = tracesDir;
  }

  async writeEvent(event: TraceEvent): Promise<void> {
    const { sid } = event;

    // Check trace events quota
    const cur = this.traceCounts.get(sid) ?? 0;
    if (cur >= DEFAULT_LIMITS.quotas.maxTraceEventsPerSession) {
      // Trace quota exceeded - cannot write more events
      // This is a safety valve; quota should be checked before reaching this limit
      throw new Error("QUOTA_EXCEEDED: max trace events");
    }

    // Get or create trace for session
    let trace = this.traces.get(sid);
    if (!trace) {
      trace = {
        events: [],
        lastHash: "",
      };
      this.traces.set(sid, trace);
    }

    // Compute hash for event
    const eventHash = this.computeEventHash(event, trace.lastHash);

    // Add hash to event
    event.hash = {
      alg: "sha256",
      prev: trace.lastHash,
      self: eventHash,
    };

    // Add event to trace
    trace.events.push(event);
    trace.lastHash = eventHash;

    // Write event to file (append)
    const tracePath = this.getTracePath(sid);
    const sessionDir = join(this.tracesDir, sid);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      tracePath,
      JSON.stringify(event) + "\n",
      { flag: "a" }
    );
  }

  async closeTrace(
    sid: AgentSessionId,
    status: "completed" | "failed" | "terminated"
  ): Promise<void> {
    const trace = this.traces.get(sid);
    if (!trace) {
      throw new Error(`Trace for session ${sid} not found`);
    }

    // Emit terminal trace event
    const terminalEvent: TraceEvent = {
      v: 1,
      ts: new Date().toISOString(),
      rid: trace.events[0].rid,
      sid,
      eid: `evt_${randomUUID()}`,
      type: `session.${status}`,
      lvl: status === "failed" ? "error" : "info",
      actor: { kind: "system", id: "trace_writer" },
      span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
      data: {
        status,
        events_count: trace.events.length,
        final_hash: trace.lastHash,
      },
    };

    await this.writeEvent(terminalEvent);

    // Remove from memory (trace is persisted on disk)
    this.traces.delete(sid);
  }

  getTracePath(sid: AgentSessionId): string {
    return join(this.tracesDir, sid, "trace.jsonl");
  }

  private computeEventHash(event: TraceEvent, prevHash: string): string {
    // Create canonical representation of event
    const canonical = JSON.stringify({
      v: event.v,
      ts: event.ts,
      rid: event.rid,
      sid: event.sid,
      eid: event.eid,
      type: event.type,
      lvl: event.lvl,
      actor: event.actor,
      span: event.span,
      data: event.data,
      prev_hash: prevHash,
    });

    return createHash("sha256").update(canonical).digest("hex");
  }
}
