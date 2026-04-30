export type LedgerEventType =
  | "run.created"
  | "plan.built"
  | "node.started"
  | "node.completed"
  | "node.failed"
  | "node.retry_scheduled"
  | "node.fallback_used"
  | "run.completed"
  | "run.failed"
  | "run.degraded"
  | "run.resumed"
  | "capsule.updated";

export interface LedgerEvent {
  event_id: string;
  run_id: string;
  node_id?: string;
  event_type: LedgerEventType;
  payload: Record<string, unknown>;
  created_at: string;
}
