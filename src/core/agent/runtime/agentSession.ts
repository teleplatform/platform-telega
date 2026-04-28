
// Agent Session Lifecycle Management

import { randomUUID } from "crypto";
import type {
  AgentSession,
  AgentSessionId,
  AgentSessionState,
  RequestId,
  AgentPlan,
} from "../../../types/agentRuntime.js";
import type { TraceWriter } from "./traceWriter.js";

export class AgentSessionManager {
  private sessions = new Map<AgentSessionId, AgentSession>();
  private traceWriter: TraceWriter;

  constructor(traceWriter: TraceWriter) {
    this.traceWriter = traceWriter;
  }

  async createSession(
    rid: RequestId,
    policy_profile: string,
    tools: string[],
    owner_id: string,
    visibility_scope: "private" | "shared" | "internal" | "public" = "private"
  ): Promise<AgentSession> {
    const sid = `sid_${randomUUID()}` as AgentSessionId;
    const now = new Date().toISOString();

    const session: AgentSession = {
      sid,
      rid,
      state: "created",
      policy_profile,
      plan: null,
      step_cursor: 0,
      tools: tools as any[],
      owner_id,
      visibility_scope,
      created_at: now,
      updated_at: now,
    };

    this.sessions.set(sid, session);

    // Emit session.created trace event
    await this.traceWriter.writeEvent({
      v: 1,
      ts: now,
      rid,
      sid,
      eid: `evt_${randomUUID()}`,
      type: "session.created",
      lvl: "info",
      actor: { kind: "system", id: "session_manager" },
      span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
      data: {
        sid,
        state: "created",
        policy_profile,
        tools,
        owner_id,
        visibility_scope,
      },
    });

    return session;
  }

  async transitionState(
    sid: AgentSessionId,
    newState: AgentSessionState,
    reason?: string
  ): Promise<void> {
    const session = this.sessions.get(sid);
    if (!session) {
      throw new Error(`Session ${sid} not found`);
    }

    const oldState = session.state;

    // Validate state transition
    if (!this.isValidTransition(oldState, newState)) {
      throw new Error(
        `Invalid state transition: ${oldState} -> ${newState}`
      );
    }

    session.state = newState;
    session.updated_at = new Date().toISOString();

    // Set timestamps for terminal states
    if (newState === "running") {
      session.started_at = session.updated_at;
    } else if (newState === "completed") {
      session.completed_at = session.updated_at;
    } else if (newState === "failed") {
      session.failed_at = session.updated_at;
    } else if (newState === "terminated") {
      session.terminated_at = session.updated_at;
      session.terminal = { reason };
    }

    // Emit session.state_changed trace event
    await this.traceWriter.writeEvent({
      v: 1,
      ts: session.updated_at,
      rid: session.rid,
      sid,
      eid: `evt_${randomUUID()}`,
      type: "session.state_changed",
      lvl: "info",
      actor: { kind: "system", id: "session_manager" },
      span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
      data: {
        old_state: oldState,
        new_state: newState,
        reason,
      },
    });
  }

  async setPlan(sid: AgentSessionId, plan: AgentPlan): Promise<void> {
    const session = this.sessions.get(sid);
    if (!session) {
      throw new Error(`Session ${sid} not found`);
    }

    session.plan = plan;
    session.updated_at = new Date().toISOString();

    // Emit plan.created trace event
    await this.traceWriter.writeEvent({
      v: 1,
      ts: session.updated_at,
      rid: session.rid,
      sid,
      eid: `evt_${randomUUID()}`,
      type: "plan.created",
      lvl: "info",
      actor: { kind: "agent", id: "planner" },
      span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
      data: {
        plan_id: plan.plan_id,
        plan_kind: plan.kind,
        summary: plan.summary,
        steps_count: plan.steps.length,
      },
    });
  }

  getSession(sid: AgentSessionId): AgentSession | undefined {
    return this.sessions.get(sid);
  }

  private isValidTransition(
    oldState: AgentSessionState,
    newState: AgentSessionState
  ): boolean {
    const validTransitions: Record<AgentSessionState, AgentSessionState[]> = {
      created: ["planning", "running", "terminated"],
      planning: ["running", "terminated"],
      running: ["completed", "failed", "terminated"],
      waiting_approval: ["running", "terminated"],
      completed: [],
      failed: [],
      terminated: [],
    };

    return validTransitions[oldState]?.includes(newState) ?? false;
  }
}
