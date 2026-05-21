import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons, type CanonEntry } from "./strategic-canon-registry.js";

export type IntentScope = "module" | "policy" | "constitution" | "doctrine" | "evidence";

export interface ImplementationIntent {
  intent_id: string;
  canon_id: string;
  canon_title: string;
  scope: IntentScope;
  description: string;
  target_module?: string;
  created_at: string;
  applied: boolean;
}

let intentCounter = 0;

export async function createImplementationIntent(canon: CanonEntry): Promise<ImplementationIntent> {
  intentCounter++;

  const scopeMap: Record<string, IntentScope> = {
    architecture: "module",
    governance: "constitution",
    safety: "policy",
    federation: "module",
    recovery: "module",
    epistemic: "evidence",
    economy: "policy",
    diplomacy: "policy",
  };

  const scope: IntentScope = scopeMap[canon.category] || "policy";

  const intent: ImplementationIntent = {
    intent_id: `intent_${Date.now()}_${intentCounter}`,
    canon_id: canon.canon_id,
    canon_title: canon.title,
    scope,
    description: `Implement canon "${canon.title}": ${canon.description}`,
    target_module: scope === "module" ? `src/runtime/${canon.category}/` : undefined,
    created_at: new Date().toISOString(),
    applied: false,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(intent.intent_id, "implementation_intent_created"),
    trace_id: intent.intent_id,
    job_id: "knowledge",
    type: "implementation_intent_created",
    timestamp: intent.created_at,
    payload: {
      intent_id: intent.intent_id,
      canon_id: canon.canon_id,
      scope,
      target_module: intent.target_module,
    },
  });

  return intent;
}

export async function generateAllIntents(): Promise<ImplementationIntent[]> {
  const canons = getActiveCanons();
  const intents: ImplementationIntent[] = [];

  for (const c of canons) {
    const intent = await createImplementationIntent(c);
    intents.push(intent);
  }

  return intents;
}
