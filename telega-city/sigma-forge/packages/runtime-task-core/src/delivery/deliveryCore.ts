import type { TaskDeliveryEnvelope } from "../../runtime-task-contracts/src/delivery.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export const VALID_DELIVERY_TARGETS = ["telegram", "web", "miniapp", "tgm", "max", "dashboard"];

export function createTaskDeliveryEnvelope(input: {
  task_id: string;
  tele_user_id: string;
  target: string;
  payload_summary: string;
  payload_ref?: string;
}): TaskDeliveryEnvelope {
  return {
    delivery_id: `delivery_${randomUUID()}`,
    task_id: input.task_id,
    tele_user_id: input.tele_user_id,
    target: input.target,
    status: "pending",
    payload_summary: input.payload_summary,
    payload_ref: input.payload_ref,
    created_at: nowIso(),
  };
}

export function resolveDeliveryTargets(task: { delivery_targets: string[] }): string[] {
  return task.delivery_targets.filter((t) => VALID_DELIVERY_TARGETS.includes(t));
}

export function canDeliverToTarget(target: string, complianceContext?: { allowed: boolean }): boolean {
  if (!VALID_DELIVERY_TARGETS.includes(target)) return false;
  if (complianceContext && !complianceContext.allowed) return false;
  return true;
}

export function deliverTaskResult(deliveries: TaskDeliveryEnvelope[]): TaskDeliveryEnvelope[] {
  return deliveries.map((d) => ({ ...d, status: "sent" as const }));
}
