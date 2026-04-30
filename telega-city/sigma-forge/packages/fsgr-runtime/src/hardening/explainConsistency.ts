import type { RunLedger } from "../../fsgr-contracts/src/index.js";
import type { LedgerEvent } from "../ledger/ledgerEvents.js";

export function validateExplainAgainstLedger(explain: any, ledger: RunLedger | null, events: LedgerEvent[], capsule: any): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!ledger) return { ok: false, errors: ["ledger is null"] };
  if (!explain) return { ok: false, errors: ["explain is null"] };
  if (!explain.ok) errors.push("explain not ok");
  if (!explain.run_summary) errors.push("missing run_summary");
  return { ok: errors.length === 0, errors };
}

export function ensureExplainIncludesExecutionTruth(explain: any): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!explain) return { ok: false, errors: ["explain is null"] };
  if (!explain.run_summary) errors.push("missing run_summary");
  if (!explain.node_transitions && !Array.isArray(explain.node_transitions)) errors.push("missing node_transitions");
  return { ok: errors.length === 0, errors };
}
