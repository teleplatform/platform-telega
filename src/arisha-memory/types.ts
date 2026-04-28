// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Alice Trust/Safety v1.0 + all prior Alice/Arisha layers
//
// CORE DECISION: Memory use ≠ memory storage ≠ personalization behavior.
// Remembered context must never automatically become active behavior.
// ─────────────────────────────────────────────────────────────

// -- Memory boundary decision --
export type ArishaMemoryBoundaryDecision = {
  mayUseMemory: boolean;

  mode:
    | "none"
    | "minimal"
    | "contextual"
    | "continuity_only";

  reason?: string;
  notes?: string[];
};

// -- Memory usage decision --
export type ArishaMemoryUsageDecision = {
  shouldUse: boolean;

  usageType:
    | "none"
    | "preference"
    | "tone"
    | "continuity"
    | "context_hint";

  reason?: string;
  notes?: string[];
};

// -- Personalization profile --
export type ArishaPersonalizationProfile = {
  toneStyle:
    | "neutral"
    | "warm"
    | "concise"
    | "supportive"
    | "playful"
    | "professional";

  verbosity:
    | "short"
    | "balanced"
    | "detailed";

  continuityLevel:
    | "low"
    | "medium"
    | "high";

  notes?: string[];
};

// -- Tone adaptation decision --
export type ArishaToneAdaptationDecision = {
  shouldAdapt: boolean;

  adaptationType:
    | "none"
    | "soften"
    | "tighten"
    | "simplify"
    | "warm_up"
    | "stay_consistent";

  reason?: string;
  notes?: string[];
};

// -- Continuity decision --
export type ArishaContinuityDecision = {
  shouldCarryContinuity: boolean;

  continuityType:
    | "none"
    | "topic_continuity"
    | "workflow_continuity"
    | "preference_continuity"
    | "style_continuity";

  reason?: string;
  notes?: string[];
};

// -- Memory trust adapter descriptor --
export type ArishaMemoryTrustAdapter = {
  adapterId: "arisha_memory_personalization_trust_v1";
  version: string;

  supportsMemoryBoundary: boolean;
  supportsMemoryUsageDecisions: boolean;
  supportsPersonalizationProfiles: boolean;
  supportsToneAdaptation: boolean;
  supportsContinuityDecisions: boolean;
  supportsDormantMemoryHandling: boolean;
};

// -- Memory/Personalization policy --
export type ArishaMemoryPersonalizationPolicy = {
  boundaryModes: ArishaMemoryBoundaryDecision["mode"][];
  usageTypes: ArishaMemoryUsageDecision["usageType"][];
  toneAdaptationModes: ArishaToneAdaptationDecision["adaptationType"][];
  continuityModes: ArishaContinuityDecision["continuityType"][];
  dormantRules: {
    maxDormantTurns: number;
    recallOnlyWhenUseful: boolean;
    neverSurfaceDormantExplicitly: boolean;
  };
  trustConstraints: {
    neverOverPersonalize: boolean;
    respectSafetyOverPersonalization: boolean;
    avoidCreepyMemorySurfacing: boolean;
    maintainOnePersonaConsistency: boolean;
  };
};

// -- ValidationError --
export type ArishaMemoryValidationError = {
  path: string;
  message: string;
};

// -- Memory context (simplified v1 representation) --
export type ArishaMemoryContext = {
  userId?: string;
  conversationTurns: number;
  hasPreferences: boolean;
  hasHistory: boolean;
  lastActiveTurnsAgo: number;
  sensitiveContextPresent: boolean;
  safetyEscalationActive: boolean;
};

// -- Main memory/personalization decision result --
export type ArishaMemoryPersonalizationDecision = {
  boundary: ArishaMemoryBoundaryDecision;
  usage: ArishaMemoryUsageDecision;
  continuity: ArishaContinuityDecision;
  profile: ArishaPersonalizationProfile;
  toneAdaptation: ArishaToneAdaptationDecision;
  dormantMemoryHandled: boolean;
  trustPreserved: boolean;
  safetyPrecedentEnforced: boolean;
};
