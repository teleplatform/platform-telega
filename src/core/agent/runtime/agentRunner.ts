

// --- ADD imports (top of file) ---
import { DEFAULT_LIMITS, type RuntimeLimits } from "./runtimeLimits.js";
import { tracePolicyChecked, tracePolicyDenied } from "./policyTrace.js";
// Agent Runner v1 (Minimal) - Pack v1.7 Agent Runner v1

import { randomUUID } from "crypto";
import type {
  AgentSession,
  AgentPlan,
  AgentStep,
  ToolCall,
  ToolResult,
  AgentSessionId,
} from "../../../types/agentRuntime.js";
import type { TraceWriter } from "./traceWriter.js";
// Import type to avoid circular dependency
import type { PolicyGate as PolicyGateInterface } from "./policyGate.js";

// Define a local interface that extends the original
interface PolicyGate extends PolicyGateInterface {
  guardNetFetch?(trace: any, sid: string, url: string): void;
  guardFsRead?(trace: any, sid: string, path: string): void;
  accountNetFetch?(sid: string): void;
  accountFsRead?(sid: string): void;
}
import type { EvidenceSealer } from "./evidence/seal.js";
import { DEFAULT_QUOTA_CONFIG, type QuotaConfig } from "./quotaConfig.js";
import { QuotaTracker } from "./quotaTracker.js";

export interface AgentRunner {
  run(session: AgentSession, input: any): Promise<RunResult>;
}

export type RunResult = {
  ok: boolean;
  assistant_message?: any;
  error?: string;
};


export class MinimalAgentRunner implements AgentRunner {
  private traceWriter: TraceWriter;
  private policyGate: PolicyGate;
  private evidenceSealer: EvidenceSealer;
  private evidenceDir: string;
  private quotaConfig: QuotaConfig;
  private quotaTracker: QuotaTracker;
  private limits: RuntimeLimits;


  constructor(
    traceWriter: TraceWriter,
    policyGate: PolicyGate,
    evidenceSealer: EvidenceSealer,
    evidenceDir: string = "./evidence",
    quotaConfig: QuotaConfig = DEFAULT_QUOTA_CONFIG,
    limits: RuntimeLimits = DEFAULT_LIMITS
  ) {
    this.traceWriter = traceWriter;
    this.policyGate = policyGate;
    this.evidenceSealer = evidenceSealer;
    this.evidenceDir = evidenceDir;
    this.quotaConfig = quotaConfig;
    this.quotaTracker = new QuotaTracker(quotaConfig);
    this.limits = limits;
  }

  async run(session: AgentSession, input: any, runtimeLimits?: RuntimeLimits): Promise<RunResult> {
    const sid = session.sid;
    const rid = session.rid;

    // Use provided limits or fall back to instance limits
    const limits = runtimeLimits || this.limits;

    // Initialize quota tracking for this session
    this.quotaTracker.initializeSession(sid);

    try {
      // Step 1: Create minimal plan (single step)
      const plan: AgentPlan = {
        plan_id: `plan_${randomUUID()}`,
        kind: "steps",
        summary: "Process user request",
        steps: [
          {
            step_id: `step_${randomUUID()}`,
            title: "Generate response",
            intent: "Generate assistant response based on user input",
          },
        ],
      };

      // Emit plan.created trace event
      await this.traceWriter.writeEvent({
        v: 1,
        ts: new Date().toISOString(),
        rid,
        sid,
        eid: `evt_${randomUUID()}`,
        type: "plan.created",
        lvl: "info",
        actor: { kind: "agent", id: "runner" },
        span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
        data: {
          plan_id: plan.plan_id,
          plan_kind: plan.kind,
          summary: plan.summary,
          steps_count: plan.steps.length,
        },
      });

      // Step 2: Execute plan
      const startedAtMs = Date.now();
      let stepsExecuted = 0;

      for (const step of plan.steps) {
        const now = Date.now();

        if (now - startedAtMs > limits.max_session_duration_ms) {
          this.denyAndStop(sid, "max_session_duration_ms", {
            used_ms: now - startedAtMs,
            limit_ms: limits.max_session_duration_ms,
          });
        }

        if (stepsExecuted >= limits.max_steps_per_session) {
          this.denyAndStop(sid, "max_steps_per_session", {
            used_steps: stepsExecuted,
            limit_steps: limits.max_steps_per_session,
          });
        }
        // Emit step.started
        await this.traceWriter.writeEvent({
          v: 1,
          ts: new Date().toISOString(),
          rid,
          sid,
          eid: `evt_${randomUUID()}`,
          type: "step.started",
          lvl: "info",
          actor: { kind: "agent", id: "runner" },
          span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
          data: {
            step_id: step.step_id,
            title: step.title,
            intent: step.intent,
          },
        });

        // Execute step
        const result = await this.executeStep(session, step, input);

        // Increment steps counter after successful execution
        stepsExecuted += 1;

        // Emit step.finished
        await this.traceWriter.writeEvent({
          v: 1,
          ts: new Date().toISOString(),
          rid,
          sid,
          eid: `evt_${randomUUID()}`,
          type: "step.finished",
          lvl: result.ok ? "info" : "error",
          actor: { kind: "agent", id: "runner" },
          span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
          data: {
            step_id: step.step_id,
            title: step.title,
            ok: result.ok,
            error: result.error,
          },
        });

        if (!result.ok) {
          return result;
        }
      }

      // Step 3: Seal evidence bundle
      const bundle = await this.evidenceSealer.sealBundle(sid, this.evidenceDir);

      // Emit evidence.bundle_finalized
      await this.traceWriter.writeEvent({
        v: 1,
        ts: new Date().toISOString(),
        rid,
        sid,
        eid: `evt_${randomUUID()}`,
        type: "evidence.bundle_finalized",
        lvl: "info",
        actor: { kind: "system", id: "evidence" },
        span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
        data: {
          bundle_id: bundle.bundle_id,
          bundle_hash: bundle.seal.bundle_hash,
          files_count: bundle.files.length,
        },
      });

      return {
        ok: true,
        assistant_message: input.messages?.[0]?.content || "",
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async executeStep(
    session: AgentSession,
    step: AgentStep,
    input: any
  ): Promise<{ ok: boolean; error?: string }> {
    // In MVP v1, we just return success
    // In a real implementation, this would:
    // 1. Call LLM to generate response
    // 2. If tools are requested, check policy and execute them
    // 3. Return the result

    return { ok: true };
  }

  private async executeTool(
    session: AgentSession,
    toolCall: ToolCall
  ): Promise<ToolResult> {
    // Check tool budget before execution
    switch (toolCall.tool_kind) {
      case "net.fetch":
        if (this.policyGate.guardNetFetch && typeof this.policyGate.guardNetFetch === 'function') {
          this.policyGate.guardNetFetch(this.traceWriter, session.sid, toolCall.params.url);
        }
        break;
      case "fs.read":
        if (this.policyGate.guardFsRead && typeof this.policyGate.guardFsRead === 'function') {
          this.policyGate.guardFsRead(this.traceWriter, session.sid, toolCall.params.path);
        }
        break;
    }

    // Check policy before execution
    const policyResult = await this.policyGate.checkToolExecution(
      session,
      toolCall
    );

    // Emit policy.checked
    await this.traceWriter.writeEvent({
      v: 1,
      ts: new Date().toISOString(),
      rid: session.rid,
      sid: session.sid,
      eid: `evt_${randomUUID()}`,
      type: "policy.checked",
      lvl: "info",
      actor: { kind: "system", id: "policy_gate" },
      span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
      data: {
        rule_id: policyResult.rule_id,
        decision: policyResult.decision,
        scope: `tool.${toolCall.tool_kind}`,
      },
    });

    // If denied, emit policy.denied and return error
    if (!policyResult.allow) {
      await this.traceWriter.writeEvent({
        v: 1,
        ts: new Date().toISOString(),
        rid: session.rid,
        sid: session.sid,
        eid: `evt_${randomUUID()}`,
        type: "policy.denied",
        lvl: "warn",
        actor: { kind: "system", id: "policy_gate" },
        span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
        data: {
          rule_id: policyResult.rule_id,
          reason: policyResult.reason,
          tool_kind: toolCall.tool_kind,
        },
      });

      return {
        ok: false,
        error: policyResult.reason,
      };
    }

    // Emit tool.called
    await this.traceWriter.writeEvent({
      v: 1,
      ts: new Date().toISOString(),
      rid: session.rid,
      sid: session.sid,
      eid: `evt_${randomUUID()}`,
      type: "tool.called",
      lvl: "info",
      actor: { kind: "agent", id: "runner" },
      span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
      data: {
        tool_kind: toolCall.tool_kind,
        args_redacted: this.redactArgs(toolCall.params),
        policy_ref: policyResult.rule_id,
      },
    });

    // Execute tool (in MVP v1, this is a stub)
    const result: ToolResult = {
      ok: true,
    };

    // Account tool usage after successful execution
    if (result.ok) {
      switch (toolCall.tool_kind) {
        case "net.fetch":
          if (this.policyGate.accountNetFetch && typeof this.policyGate.accountNetFetch === 'function') {
            this.policyGate.accountNetFetch(session.sid);
          }
          break;
        case "fs.read":
          if (this.policyGate.accountFsRead && typeof this.policyGate.accountFsRead === 'function') {
            this.policyGate.accountFsRead(session.sid);
          }
          break;
      }
    }

    // Emit tool.result
    await this.traceWriter.writeEvent({
      v: 1,
      ts: new Date().toISOString(),
      rid: session.rid,
      sid: session.sid,
      eid: `evt_${randomUUID()}`,
      type: "tool.result",
      lvl: result.ok ? "info" : "error",
      actor: { kind: "tool", id: toolCall.tool_kind },
      span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
      data: {
        tool_kind: toolCall.tool_kind,
        ok: result.ok,
        result_ref: result.result_ref,
        error: result.error,
      },
    });

    return result;
  }

  private denyAndStop(sid: string, reason: string, meta: Record<string, any> = {}) {
    // trace-first: сначала фиксируем факт проверки/отказа
    tracePolicyChecked(this.traceWriter as any, sid, "quota", { reason, ...meta });

    tracePolicyDenied(this.traceWriter as any, sid, "quota", reason, meta);

    // контролируемый stop
    const err = new Error(`policy.denied: ${reason}`);
    (err as any).code = "POLICY_DENIED";
    (err as any).policy = { rule: "quota", reason, meta };
    throw err;
  }

  private redactArgs(params: Record<string, any>): Record<string, any> {
    // Redact sensitive fields
    const redacted: Record<string, any> = {};
    const sensitiveFields = ["api_key", "token", "password", "secret"];

    for (const [key, value] of Object.entries(params)) {
      if (sensitiveFields.includes(key)) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }
}
