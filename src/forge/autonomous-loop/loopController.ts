import { LoopSession, LoopStep, LoopConfig, LoopStatus } from "./loopTypes";
import { TaskRegistry } from "../agent-tasks/taskRegistry.js";
import { startExecution, completeExecution, failExecution, ExecutionRegistry } from "../execution-runner/index.js";
import { VerificationRegistry, createChecks } from "../execution-verifier/index.js";
import { RecoveryPolicyRegistry } from "../recovery-policy/index.js";
import { GovernanceRegistry } from "../governance/outcomeRegistry.js";

const DEFAULT_CONFIG: LoopConfig = {
  maxSteps: 10,
  maxRetriesPerStep: 3,
  requireVerification: true,
  stopOnCriticalRisk: true,
  stopOnSameErrorTwice: true,
};

const sessions = new Map<string, LoopSession>();

let counter = 0;
function genId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

function writeEvidence(kind: string, summary: string, details: Record<string, unknown>): string {
  const outcome = GovernanceRegistry.record(kind as any, "mission" as any, "info", summary, details, []);
  return outcome.outcomeId;
}

function createStep(taskId: string): LoopStep {
  return {
    stepId: genId("step"),
    taskId,
    status: "pending",
    attempts: 0,
    lastError: null,
    evidenceRefs: [],
    createdAt: Date.now(),
    completedAt: null,
  };
}

export function createLoopSession(
  graphId: string,
  name: string,
  taskIds: string[],
  config?: Partial<LoopConfig>
): LoopSession {
  const session: LoopSession = {
    id: genId("loop"),
    graphId,
    name,
    status: "running",
    config: { ...DEFAULT_CONFIG, ...config },
    steps: taskIds.map(createStep),
    currentStepIndex: 0,
    evidenceRefs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const evRef = writeEvidence("loop_created", `Loop "${name}" created with ${taskIds.length} steps`, {
    loopId: session.id, graphId, steps: taskIds.length,
  });
  session.evidenceRefs.push(evRef);

  sessions.set(session.id, session);
  return session;
}

export async function advanceLoop(loopId: string): Promise<LoopSession | null> {
  const session = sessions.get(loopId);
  if (!session) return null;

  if (session.status !== "running") return session;

  // Check if we exceeded max steps
  if (session.currentStepIndex >= session.config.maxSteps ||
      session.currentStepIndex >= session.steps.length) {
    session.status = "completed";
    const evRef = writeEvidence("loop_completed", `Loop "${session.name}" completed`, {
      loopId, stepsExecuted: session.currentStepIndex,
    });
    session.evidenceRefs.push(evRef);
    session.updatedAt = Date.now();
    return session;
  }

  const step = session.steps[session.currentStepIndex];
  if (!step) {
    session.status = "completed";
    session.updatedAt = Date.now();
    return session;
  }

  // Mark step as running
  step.status = "running";
  session.updatedAt = Date.now();

  // Execute the task
  const task = TaskRegistry.get(step.taskId);
  if (!task) {
    step.status = "failed";
    step.lastError = "Task not found";
    session.currentStepIndex++;
    session.updatedAt = Date.now();
    return session;
  }

  // Make task ready and execute
  TaskRegistry.update(step.taskId, { status: "ready" });
  const run = await startExecution(step.taskId, session.graphId);
  if (!run) {
    step.status = "failed";
    step.lastError = "Failed to start execution";
    session.currentStepIndex++;
    session.updatedAt = Date.now();
    return session;
  }

  step.attempts++;
  step.evidenceRefs.push(...run.evidenceRefs);

  // Simulate execution completion with verification
  await completeExecution(run.id, "Step executed");

  // Run verification
  if (session.config.requireVerification) {
    const checks = createChecks(true, false, true, true);
    const verification = VerificationRegistry.create(run.id, step.taskId, session.graphId, checks);

    if (verification.verdict === "failed") {
      step.status = "failed";
      step.lastError = "Verification failed";

      // Create recovery plan
      RecoveryPolicyRegistry.createPlan(step.taskId, session.graphId, run.id, "verification_failed", step.attempts);

      // Check same error twice
      if (session.config.stopOnSameErrorTwice && step.attempts > 1 && step.lastError === "Verification failed") {
        session.status = "blocked";
        const evRef = writeEvidence("loop_blocked", `Loop blocked: same error twice on step ${session.currentStepIndex}`, {
          loopId, stepIndex: session.currentStepIndex, error: step.lastError,
        });
        session.evidenceRefs.push(evRef);
        session.updatedAt = Date.now();
        return session;
      }

      // Check max retries
      if (step.attempts >= session.config.maxRetriesPerStep) {
        session.status = "blocked";
        const evRef = writeEvidence("loop_blocked", `Loop blocked: max retries on step ${session.currentStepIndex}`, {
          loopId, stepIndex: session.currentStepIndex, attempts: step.attempts,
        });
        session.evidenceRefs.push(evRef);
        session.updatedAt = Date.now();
        return session;
      }

      // Retry
      step.status = "pending";
      step.lastError = null;
      session.updatedAt = Date.now();
      return session;
    }

    step.evidenceRefs.push(...verification.evidenceRefs);
  }

  // Step passed
  step.status = "completed";
  step.completedAt = Date.now();
  session.currentStepIndex++;
  session.updatedAt = Date.now();

  const evRef = writeEvidence("loop_step_completed", `Step ${session.currentStepIndex}/${session.steps.length} completed`, {
    loopId, stepIndex: session.currentStepIndex - 1, taskId: step.taskId,
  });
  session.evidenceRefs.push(evRef);

  return session;
}

export function getLoopSession(id: string): LoopSession | undefined {
  return sessions.get(id);
}

export function getAllLoopSessions(): LoopSession[] {
  return Array.from(sessions.values());
}

export function cancelLoopSession(id: string): LoopSession | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (session.status === "completed") return null;

  session.status = "cancelled";
  session.updatedAt = Date.now();
  const evRef = writeEvidence("loop_cancelled", `Loop "${session.name}" cancelled`, { loopId: id });
  session.evidenceRefs.push(evRef);
  return session;
}
