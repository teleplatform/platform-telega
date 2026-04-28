// Quota Tracker - Track and enforce quota limits

import type { QuotaConfig, QuotaViolation } from "./quotaConfig.js";
import type { AgentSessionId } from "../../../types/agentRuntime.js";

/**
 * Quota usage tracker for a session
 */
export interface QuotaUsage {
  steps: number;
  traceEvents: number;
  evidenceBytes: number;
  startTime: number;
}

/**
 * Quota tracker for enforcing limits
 */
export class QuotaTracker {
  private quotaConfig: QuotaConfig;
  private sessionUsage = new Map<AgentSessionId, QuotaUsage>();

  constructor(quotaConfig: QuotaConfig) {
    this.quotaConfig = quotaConfig;
  }

  /**
   * Initialize quota tracking for a session
   */
  initializeSession(sid: AgentSessionId): void {
    this.sessionUsage.set(sid, {
      steps: 0,
      traceEvents: 0,
      evidenceBytes: 0,
      startTime: Date.now(),
    });
  }

  /**
   * Check if session can proceed with next step
   */
  checkStepLimit(sid: AgentSessionId): QuotaViolation | null {
    const usage = this.sessionUsage.get(sid);
    if (!usage) {
      return null;
    }

    const currentDuration = Date.now() - usage.startTime;

    // Check all quota limits
    if (usage.steps >= this.quotaConfig.maxStepsPerSession) {
      return {
        type: "max_steps_exceeded",
        limit: this.quotaConfig.maxStepsPerSession,
        actual: usage.steps,
        message: `Maximum steps per session exceeded (${usage.steps}/${this.quotaConfig.maxStepsPerSession})`,
      };
    }

    if (usage.traceEvents >= this.quotaConfig.maxTraceEvents) {
      return {
        type: "max_trace_events_exceeded",
        limit: this.quotaConfig.maxTraceEvents,
        actual: usage.traceEvents,
        message: `Maximum trace events per session exceeded (${usage.traceEvents}/${this.quotaConfig.maxTraceEvents})`,
      };
    }

    if (usage.evidenceBytes >= this.quotaConfig.maxEvidenceBytes) {
      return {
        type: "max_evidence_bytes_exceeded",
        limit: this.quotaConfig.maxEvidenceBytes,
        actual: usage.evidenceBytes,
        message: `Maximum evidence bytes per session exceeded (${usage.evidenceBytes}/${this.quotaConfig.maxEvidenceBytes})`,
      };
    }

    if (currentDuration >= this.quotaConfig.maxSessionDurationMs) {
      return {
        type: "max_session_duration_exceeded",
        limit: this.quotaConfig.maxSessionDurationMs,
        actual: currentDuration,
        message: `Maximum session duration exceeded (${currentDuration}ms/${this.quotaConfig.maxSessionDurationMs}ms)`,
      };
    }

    return null;
  }

  /**
   * Increment step counter
   */
  incrementStep(sid: AgentSessionId): void {
    const usage = this.sessionUsage.get(sid);
    if (usage) {
      usage.steps += 1;
    }
  }

  /**
   * Increment trace event counter
   */
  incrementTraceEvent(sid: AgentSessionId): void {
    const usage = this.sessionUsage.get(sid);
    if (usage) {
      usage.traceEvents += 1;
    }
  }

  /**
   * Add evidence bytes
   */
  addEvidenceBytes(sid: AgentSessionId, bytes: number): void {
    const usage = this.sessionUsage.get(sid);
    if (usage) {
      usage.evidenceBytes += bytes;
    }
  }

  /**
   * Get current usage for a session
   */
  getUsage(sid: AgentSessionId): QuotaUsage | undefined {
    return this.sessionUsage.get(sid);
  }

  /**
   * Clean up session tracking
   */
  cleanupSession(sid: AgentSessionId): void {
    this.sessionUsage.delete(sid);
  }
}
