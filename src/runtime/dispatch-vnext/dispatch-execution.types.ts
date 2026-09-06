import type { DispatchAuthzContext } from "./dispatch.types.js";

// PD-W2/A5 — Execution boundary: plan is not execution. These are the
// deterministic, canonical execution states for a dispatched action.
export type DispatchExecutionState =
  | "planned"
  | "executing"
  | "completed"
  | "failed"
  | "denied"
  | "approval_required"
  | "unavailable";

// Execution context is supplied at execution time and re-verified against the
// plan. subject may only carry a server-validated identity; no self-asserted actor.
export interface DispatchExecutionContext {
  readonly subject: string;
  readonly authz: DispatchAuthzContext;
  readonly payload?: Record<string, unknown>;
}

// A result of running a bound executor. output carries the real authoritative
// execution outcome only — never a fabricated completion.
export interface DispatchExecutionOutcome<R> {
  readonly status: "completed" | "failed";
  readonly execution_id: string;
  readonly target?: string;
  readonly provider_result_ref?: string;
  readonly output_ref?: string;
  readonly output?: R;
  readonly started_at: string;
  readonly completed_at: string;
  readonly error?: { readonly message: string; readonly failure_type?: string };
}

export interface DispatchResult<R> {
  readonly dispatch_id: string;
  readonly plan_id: string;
  readonly execution_state: DispatchExecutionState;
  readonly outcome?: DispatchExecutionOutcome<R>;
  readonly evidence_refs: string[];
  readonly reason_code?: string;
  readonly reasons: string[];
}