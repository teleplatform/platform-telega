import type { TaskIntentEnvelope } from "../../../fsgr-contracts/src/index.js";

export function normalizeTaskIntent(envelope: TaskIntentEnvelope): TaskIntentEnvelope {
  return {
    ...envelope,
    task_id: (envelope.task_id ?? "").trim() || `task_${Date.now()}`,
    actor_id: (envelope.actor_id ?? "").trim(),
    intent_key: (envelope.intent_key ?? "").trim() || "default",
    task_kind: (envelope.task_kind || "general").toLowerCase().trim(),
    goal: (envelope.goal ?? "").trim() || "Process task",
    constraints: (envelope.constraints ?? []).map((c) => c.trim()).filter(Boolean),
    execution_mode: envelope.execution_mode ?? "safe",
    budget_class: envelope.budget_class ?? "medium",
    privacy_preference: envelope.privacy_preference ?? "allow_remote",
    metadata: envelope.metadata ? { ...envelope.metadata } : {},
  };
}
