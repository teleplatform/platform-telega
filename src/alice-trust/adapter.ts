// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Main Handler
//
// prepareAliceTrustSafetyDecision() does ONLY:
// 1. classify conversational risk
// 2. detect sensitive intent
// 3. resolve trust boundary
// 4. resolve refusal decision
// 5. resolve safe mode decision
// 6. resolve escalation path
// 7. apply voice-safe shaping
// 8. preserve Arisha tone
// 9. never allow friendly tone to bypass safety boundary
// ─────────────────────────────────────────────────────────────

import type { AliceTrustSafetyDecision, AliceConversationRiskClass } from "./types.js";
import { classifyAliceConversationRisk } from "./classification.js";
import { buildAliceTrustBoundaryDecision } from "./boundaries.js";
import { buildAliceRefusalDecision } from "./refusal.js";
import { buildAliceSafeModeDecision } from "./safe-mode.js";
import { resolveAliceSafetyEscalationPath } from "./escalation.js";
import { buildAliceVoiceSafeShape } from "./shaping.js";
import { preserveArishaSafetyPersonaTone } from "./persona.js";

export function prepareAliceTrustSafetyDecision(input: {
  utterance: string;
  contextHints?: string[];
  customResponseText?: string;
  maxWords?: number;
  repeatedTriggers?: number;
}): AliceTrustSafetyDecision {
  const utterance = input.utterance;
  const contextHints = input.contextHints;

  // 1. Classify conversational risk
  const classification = classifyAliceConversationRisk({ utterance, contextHints });
  const riskClass = classification.riskClass;
  const sensitiveIntent = classification.sensitiveIntent;

  // 2. Detect sensitive intent (already done in classification, but explicit)
  // sensitiveIntent is populated from classification

  // 3. Resolve trust boundary
  const trustBoundary = buildAliceTrustBoundaryDecision({ riskClass, contextSafe: true });

  // 4. Resolve refusal decision
  const refusal = buildAliceRefusalDecision({ riskClass, contextHints });

  // 5. Resolve safe mode decision
  const safeMode = buildAliceSafeModeDecision({
    riskClass,
    escalationRequired: false,
  });

  // 6. Resolve escalation path
  const escalation = resolveAliceSafetyEscalationPath({
    riskClass,
    refusal,
    repeatedTriggers: input.repeatedTriggers,
  });

  // 7. Apply voice-safe shaping
  const shapedResponse = buildAliceVoiceSafeShape({
    refusal,
    customText: input.customResponseText,
    maxWords: input.maxWords,
  });

  // 8. Preserve Arisha tone (validation)
  const personaCheck = preserveArishaSafetyPersonaTone({ refusal, safeMode });

  // Ensure shaped response preserves persona
  shapedResponse.preservesPersona = personaCheck.preservesPersona;

  // 9. Return — never allow friendly tone to bypass safety boundary
  // (Risk classification is based on content, not tone, so this is enforced by design)

  return {
    riskClass,
    sensitiveIntent,
    trustBoundary,
    refusal,
    safeMode,
    escalation,
    shapedResponse,
  };
}
