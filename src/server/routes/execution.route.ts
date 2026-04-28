/**
 * Execution Target Routes — Bridges artifact pipeline handoff to execution
 *
 * When an artifact completes handoff in the pipeline, this layer
 * creates an execution-ready mirror that can be prepared and run.
 *
 * Endpoints:
 *   POST /v1/execution/prepare — Prepare artifact for execution
 *   POST /v1/execution/run     — Execute prepared artifact
 *   GET  /v1/execution/:id/status — Get execution status
 *   GET  /v1/execution/list   — List all executions
 */

import type { FastifyInstance } from "fastify";
import * as artifactRegistry from "../../forge-bridge/artifactRegistry.js";

// ============================================================================
// Execution Store (in-memory)
// ============================================================================

export type ExecutionState =
  | "prepared"
  | "running"
  | "completed"
  | "failed"
  | "rolled_back";

export interface ExecutionRecord {
  executionId: string;
  artifactId: string;
  target: string;
  state: ExecutionState;
  traceId: string;
  createdAt: number;
  preparedAt?: number;
  runAt?: number;
  completedAt?: number;
  result?: Record<string, unknown>;
  error?: string;
}

const _executionStore = new Map<string, ExecutionRecord>();

function createExecution(input: {
  artifactId: string;
  target: string;
  traceId: string;
}): ExecutionRecord {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const record: ExecutionRecord = {
    executionId,
    artifactId: input.artifactId,
    target: input.target,
    state: "prepared",
    traceId: input.traceId,
    createdAt: Date.now(),
    preparedAt: Date.now(),
  };

  _executionStore.set(executionId, record);
  return record;
}

function getExecution(executionId: string): ExecutionRecord | undefined {
  return _executionStore.get(executionId);
}

function getExecutionsByArtifact(artifactId: string): ExecutionRecord[] {
  return Array.from(_executionStore.values()).filter(
    (e) => e.artifactId === artifactId,
  );
}

function listExecutions(): ExecutionRecord[] {
  return Array.from(_executionStore.values())
    .sort((a, b) => b.createdAt - a.createdAt);
}

function updateExecutionState(
  executionId: string,
  state: ExecutionState,
  result?: Record<string, unknown>,
  error?: string,
): ExecutionRecord | undefined {
  const record = _executionStore.get(executionId);
  if (!record) return undefined;

  record.state = state;
  if (state === "running") record.runAt = Date.now();
  if (state === "completed" || state === "failed" || state === "rolled_back") {
    record.completedAt = Date.now();
  }
  if (result) record.result = result;
  if (error) record.error = error;

  return record;
}

export function clearExecutionStore(): void {
  _executionStore.clear();
}

// ============================================================================
// Pipeline-to-Execution Bridge
// ============================================================================

function isArtifactExecutionReady(artifactId: string): {
  ready: boolean;
  reason?: string;
  artifact?: any;
} {
  const entry = artifactRegistry.getArtifact(artifactId);

  if (!entry) {
    return { ready: false, reason: "Artifact not found in registry" };
  }

  return { ready: true, artifact: entry };
}

// ============================================================================
// Routes
// ============================================================================

export async function registerExecutionRoutes(app: FastifyInstance) {
  // ─── Prepare Execution ───

  app.post<{
    Body: {
      artifact_id: string;
      traceId: string;
      target: string;
    };
  }>("/v1/execution/prepare", async (req) => {
    const { artifact_id, traceId, target } = req.body;

    // Check if artifact exists and is ready for execution
    const readiness = isArtifactExecutionReady(artifact_id);

    if (!readiness.ready) {
      return {
        ok: false,
        allowed: false,
        validatorPassed: false,
        reason: readiness.reason,
        artifact_id,
      };
    }

    // Create execution record
    const execution = createExecution({
      artifactId: artifact_id,
      target: target ?? "web_delivery",
      traceId: traceId ?? `trace_exec_${Date.now()}`,
    });

    return {
      ok: true,
      allowed: true,
      validatorPassed: true,
      execution_id: execution.executionId,
      artifact_id: artifact_id,
      target: execution.target,
      state: execution.state,
      prepared_at: execution.preparedAt,
    };
  });

  // ─── Run Execution ───

  app.post<{
    Body: {
      artifact_id: string;
      traceId: string;
      target?: string;
      execution_id?: string;
    };
  }>("/v1/execution/run", async (req) => {
    const { artifact_id, traceId, target } = req.body;

    // If execution_id provided, use it
    let execution: ExecutionRecord | undefined;

    if (req.body.execution_id) {
      execution = getExecution(req.body.execution_id);
      if (!execution) {
        return {
          ok: false,
          error: "Execution not found",
          execution_id: req.body.execution_id,
        };
      }
    } else {
      // Find or create execution for this artifact
      const existingExecutions = getExecutionsByArtifact(artifact_id);
      const prepared = existingExecutions.find(
        (e) => e.state === "prepared" && (!target || e.target === target),
      );

      if (prepared) {
        execution = prepared;
      } else {
        // Check artifact exists
        const readiness = isArtifactExecutionReady(artifact_id);
        if (!readiness.ready) {
          return {
            ok: false,
            error: "EXECUTION_VALIDATION_FAILED",
            reason: readiness.reason,
            artifact_id,
          };
        }

        // Create execution on-the-fly
        execution = createExecution({
          artifactId: artifact_id,
          target: target ?? "web_delivery",
          traceId: traceId ?? `trace_exec_${Date.now()}`,
        });
      }
    }

    if (execution.state !== "prepared") {
      return {
        ok: false,
        error: "EXECUTION_ALREADY_RUN",
        execution_id: execution.executionId,
        state: execution.state,
      };
    }

    // Mark as running
    updateExecutionState(execution.executionId, "running");

    // Simulate execution (in real system, this would run the actual target)
    const artifact = artifactRegistry.getArtifact(artifact_id);

    const result = {
      status: "completed",
      artifact_id: artifact_id,
      artifact_type: artifact?.artifact.type ?? "unknown",
      target: execution.target,
      execution_time_ms: Math.floor(Math.random() * 500) + 100,
      output: `Executed ${artifact_id} for target ${execution.target}`,
    };

    // Mark as completed
    updateExecutionState(execution.executionId, "completed", result);

    return {
      ok: true,
      execution_id: execution.executionId,
      artifact_id: artifact_id,
      target: execution.target,
      state: "completed",
      result,
      completed_at: execution.completedAt,
    };
  });

  // ─── Get Execution Status ───

  app.get<{ Params: { id: string } }>("/v1/execution/:id/status", async (req) => {
    const { id } = req.params;

    const execution = getExecution(id);
    if (!execution) {
      return {
        ok: false,
        error: "Execution not found",
        execution_id: id,
      };
    }

    return {
      ok: true,
      execution_id: execution.executionId,
      artifact_id: execution.artifactId,
      target: execution.target,
      state: execution.state,
      trace_id: execution.traceId,
      created_at: execution.createdAt,
      prepared_at: execution.preparedAt,
      run_at: execution.runAt,
      completed_at: execution.completedAt,
      result: execution.result,
      error: execution.error,
    };
  });

  // ─── List Executions ───

  app.get("/v1/execution/list", async () => {
    const executions = listExecutions();

    return {
      ok: true,
      executions: executions.map((e) => ({
        execution_id: e.executionId,
        artifact_id: e.artifactId,
        target: e.target,
        state: e.state,
        created_at: e.createdAt,
        completed_at: e.completedAt,
      })),
      count: executions.length,
    };
  });

  // ─── Rollback Execution ───

  app.post<{ Params: { id: string } }>("/v1/execution/:id/rollback", async (req) => {
    const { id } = req.params;

    const execution = getExecution(id);
    if (!execution) {
      return {
        ok: false,
        error: "Execution not found",
        execution_id: id,
      };
    }

    if (execution.state === "rolled_back") {
      return {
        ok: false,
        error: "Execution already rolled back",
        execution_id: id,
      };
    }

    updateExecutionState(execution.executionId, "rolled_back", undefined, "Manual rollback");

    return {
      ok: true,
      execution_id: id,
      state: "rolled_back",
      rolled_back_at: Date.now(),
    };
  });

  app.log && (app.log as any).info?.("[execution] Routes registered");
}
