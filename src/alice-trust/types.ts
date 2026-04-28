// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Alice Incident/Recovery v1.0 + all prior Alice layers
//
// CORE DECISION: Conversational safety ≠ runtime safety ≠ incident safety.
// Friendly conversational tone must never bypass safety discipline.
// ─────────────────────────────────────────────────────────────

// -- Conversation risk class --
export type AliceConversationRiskClass =
  | "safe"
  | "sensitive"
  | "unsafe"
  | "high_risk"
  | "unknown";

// -- Trust boundary decision --
export type AliceTrustBoundaryDecision = {
  accepted: boolean;

  boundaryMode:
    | "normal"
    | "bounded"
    | "refusal"
    | "safe_mode";

  reason?: string;
  notes?: string[];
};

// -- Refusal decision --
export type AliceRefusalDecision = {
  shouldRefuse: boolean;
  refusalType:
    | "none"
    | "soft_refusal"
    | "firm_refusal"
    | "redirect"
    | "safety_block";

  reason?: string;
  notes?: string[];
};

// -- Safe mode decision --
export type AliceSafeModeDecision = {
  activate: boolean;
  mode:
    | "none"
    | "bounded_answer"
    | "clarify_only"
    | "refuse_only"
    | "handoff_safe";

  reason?: string;
  notes?: string[];
};

// -- Sensitive intent decision --
export type AliceSensitiveIntentDecision = {
  detected: boolean;
  category:
    | "self_harm"
    | "violence"
    | "illegal"
    | "privacy"
    | "medical"
    | "sexual"
    | "manipulation"
    | "unknown"
    | "none";

  requiresBoundary: boolean;
  notes?: string[];
};

// -- Trust safety adapter descriptor --
export type AliceTrustSafetyAdapter = {
  adapterId: "alice_trust_safety_v1";
  version: string;

  supportsRiskClassification: boolean;
  supportsTrustBoundaries: boolean;
  supportsRefusalDiscipline: boolean;
  supportsSafeMode: boolean;
  supportsSensitiveIntentHandling: boolean;
  supportsVoiceSafeShaping: boolean;
};

// -- Trust/safety policy --
export type AliceTrustSafetyPolicy = {
  enabledRiskClasses: AliceConversationRiskClass[];
  refusalTypes: AliceRefusalDecision["refusalType"][];
  safeModes: AliceSafeModeDecision["mode"][];
  sensitiveCategories: AliceSensitiveIntentDecision["category"][];
  shapingConstraints: {
    maxWords: number;
    avoidThreateningTone: boolean;
    avoidSystemBotTone: boolean;
    requireBrevity: boolean;
  };
};

// -- ValidationError --
export type AliceTrustValidationError = {
  path: string;
  message: string;
};

// -- Escalation path --
export type AliceSafetyEscalationPath = {
  escalationLevel: "clarify_only" | "safe_mode" | "refusal" | "handoff_safe";
  reason: string;
  notes?: string[];
};

// -- Voice-safe shaped response --
export type AliceVoiceSafeShape = {
  text: string;
  tone: "warm_bounded" | "firm_refusal" | "redirect_calm" | "safety_block_calm";
  wordCount: number;
  preservesPersona: boolean;
};

// -- Main trust safety decision result --
export type AliceTrustSafetyDecision = {
  riskClass: AliceConversationRiskClass;
  sensitiveIntent: AliceSensitiveIntentDecision;
  trustBoundary: AliceTrustBoundaryDecision;
  refusal: AliceRefusalDecision;
  safeMode: AliceSafeModeDecision;
  escalation: AliceSafetyEscalationPath;
  shapedResponse: AliceVoiceSafeShape;
};
