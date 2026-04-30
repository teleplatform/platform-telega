import type { HumanDecision } from "../../runtime-hitl-contracts/src/decision.js";
import type { HumanHandoffPacket } from "../../runtime-hitl-contracts/src/handoff.js";
import { validateHumanDecision } from "./decisionValidation.js";

export interface DecisionStorage {
  saveDecision: (d: HumanDecision) => void;
}

export function recordHumanDecision(decision: HumanDecision, storage: DecisionStorage): void {
  storage.saveDecision(decision);
}

export function resolveDecision(packet: HumanHandoffPacket, decision: HumanDecision, storage: DecisionStorage): { valid: boolean; errors: string[]; resolution?: any } {
  const validation = validateHumanDecision(packet, decision);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  recordHumanDecision(decision, storage);

  const { resolveHumanDecision } = require("./decisionResolver.js");
  const resolution = resolveHumanDecision(packet, decision);

  return { valid: true, errors: [], resolution };
}
