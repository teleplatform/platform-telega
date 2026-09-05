import { RecoveryPlan, RecoveryAction, ErrorClass, DEFAULT_RETRY_POLICY } from "./recoveryTypes";

const plans = new Map<string, RecoveryPlan>();

let counter = 0;
function genId(): string {
  counter++;
  return `rp_${Date.now()}_${counter}`;
}

function classifyError(error: string): ErrorClass {
  const lower = error.toLowerCase();
  for (const [pattern, cls] of Object.entries(DEFAULT_RETRY_POLICY.errorClassification)) {
    if (lower.includes(pattern)) return cls;
  }
  return "recoverable";
}

function determineAction(errorClass: ErrorClass, retryCount: number): RecoveryAction {
  if (errorClass === "fatal") return "stop";
  if (retryCount >= DEFAULT_RETRY_POLICY.maxRetries) return "escalate";
  return "retry";
}

function calculateNextRetry(retryCount: number, lastRetryAt: number | null): number | null {
  if (lastRetryAt === null) return Date.now() + DEFAULT_RETRY_POLICY.cooldownMs;
  const delay = DEFAULT_RETRY_POLICY.cooldownMs * Math.pow(DEFAULT_RETRY_POLICY.backoffFactor, retryCount);
  return Date.now() + Math.min(delay, 300000); // cap at 5 min
}

export const RecoveryPolicyRegistry = {
  createPlan(
    taskId: string,
    graphId: string,
    executionRunId: string,
    error: string,
    currentRetryCount?: number
  ): RecoveryPlan {
    const errorClass = classifyError(error);
    const retryCount = currentRetryCount ?? 0;
    const action = determineAction(errorClass, retryCount);

    const plan: RecoveryPlan = {
      id: genId(),
      taskId,
      graphId,
      executionRunId,
      error,
      errorClass,
      action,
      retryCount,
      lastRetryAt: null,
      nextRetryAt: action === "retry" ? calculateNextRetry(retryCount, null) : null,
      evidenceRefs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    plans.set(plan.id, plan);
    return plan;
  },

  get(id: string): RecoveryPlan | undefined {
    return plans.get(id);
  },

  getAll(): RecoveryPlan[] {
    return Array.from(plans.values());
  },

  listByTask(taskId: string): RecoveryPlan[] {
    return Array.from(plans.values()).filter((p) => p.taskId === taskId);
  },

  listByAction(action: RecoveryAction): RecoveryPlan[] {
    return Array.from(plans.values()).filter((p) => p.action === action);
  },

  updatePlan(id: string, updates: Partial<RecoveryPlan>): RecoveryPlan | null {
    const existing = plans.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    plans.set(id, updated);
    return updated;
  },

  retry(planId: string): RecoveryPlan | null {
    const plan = plans.get(planId);
    if (!plan) return null;
    if (plan.action !== "retry") return null;

    const newRetryCount = plan.retryCount + 1;
    const action = determineAction(plan.errorClass, newRetryCount);

    return this.updatePlan(planId, {
      retryCount: newRetryCount,
      action,
      lastRetryAt: Date.now(),
      nextRetryAt: action === "retry" ? calculateNextRetry(newRetryCount, Date.now()) : null,
    });
  },

  size(): number {
    return plans.size;
  },
};
