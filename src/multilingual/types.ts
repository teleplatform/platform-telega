// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Core Types
//
// Status: CANONICAL_RUNTIME_SPEC
// Owner: Tele•GPT / Tele•Ga Core Architecture
// Scope: Language Packs / Multilingual Runtime / Persona Consistency / Rollout / Rollback / Validation / Surface Capability
// Applies to: Tele•GPT, Tele•Ga, T•G Messenger, Web, Voice Surfaces, Arisha, future multilingual bridges
//
// CORE DECISION: Новый язык = отдельный language pack, а не изменение core runtime.
// Язык НЕ имеет права менять: session logic, identity, policy, permissions,
// execution boundary, delivery logic, trace schema, creator/user split, persona identity, safety posture.
// ─────────────────────────────────────────────────────────────

// -- Language pack as first-class object --
export type LanguagePack = {
  languageCode: string;
  version: string;
  status: LanguagePackStatus;
  manifest: LanguagePackManifest;
  understanding: LanguageUnderstandingProfile;
  intents: LanguageIntentMappings;
  ux: LanguageUxPack;
  persona: LanguagePersonaPack;
  voice?: LanguageVoicePack;
  validation: LanguageValidationPack;
  rollout: LanguageRolloutConfig;
  rollback: LanguageRollbackConfig;
  capability: LanguageCapabilityMatrix;
};

export type LanguagePackStatus =
  | "declared"
  | "understanding_ready"
  | "localized"
  | "validated"
  | "limited_rollout"
  | "production"
  | "disabled";

// -- Manifest contract --
export type LanguagePackManifest = {
  languageCode: string;
  languageName: string;
  nativeName?: string;
  tier: "tier1" | "tier2" | "tier3";
  rtl?: boolean;
  fallbackLanguage: "en";
  multilingualReady: boolean;
  supportedSurfaces: Array<"web" | "tgm" | "telegram" | "voice" | "operator">;
  notes?: string[];
};

// -- Understanding profile --
export type LanguageUnderstandingProfile = {
  intentMappingsVersion: string;
  entityBehavior: "strict" | "moderate" | "limited";
  ambiguityPolicy: "clarify" | "safe_fallback";
  protectedIntentHandling: "deny_or_clarify";
  localeHints?: string[];
};

// -- Intent mappings contract --
// Expands language understanding without creating new policy or changing core intent law.
export type LanguageIntentMappings = {
  version: string;
  intents: Array<{
    coreIntentId: string;
    examples: string[];
    aliases?: string[];
    protected?: boolean;
  }>;
};

// -- UX localization pack --
export type LanguageUxPack = {
  greetings: Record<string, string>;
  confirmations: Record<string, string>;
  clarifications: Record<string, string>;
  help: Record<string, string>;
  errors: Record<string, string>;
  delivery: Record<string, string>;
  taskStatus: Record<string, string>;
  blocked: Record<string, string>;
  safeFailure: Record<string, string>;
};

// -- Persona tone pack --
// ONE persona — different languages — unified character
export type LanguagePersonaPack = {
  personaId: "arisha";
  toneClassByMode: {
    creator: string;
    user: string;
    neutral: string;
  };
  forbiddenTonePatterns?: string[];
  consistencyNotes?: string[];
};

// -- Voice pack --
export type LanguageVoicePack = {
  textReady: boolean;
  voiceReady: boolean;
  preferredVoiceSurface?: "alice_bridge" | "telegram_voice" | "web_voice";
  fallbackToText: boolean;
  voiceNotes?: string[];
};

// -- Validation pack --
export type LanguageValidationPack = {
  requiredTests: string[];
  personaConsistencyChecks: string[];
  protectedIntentChecks: string[];
  fallbackChecks: string[];
  surfaceChecks: string[];
};

// -- Rollout config --
export type LanguageRolloutConfig = {
  featureFlag: string;
  enabledSurfaces: string[];
  enabledRoles: Array<"creator" | "operator" | "user">;
  rolloutStage: "off" | "internal" | "creator_only" | "limited_users" | "production";
};

// -- Rollback config --
export type LanguageRollbackConfig = {
  instantDisable: boolean;
  disableBySurface: boolean;
  disableByRole: boolean;
  fallbackLanguage: "en";
  rollbackNotes?: string[];
};

// -- Capability matrix --
// language × surface × capability
export type LanguageCapabilityMatrix = {
  web: "none" | "text_ready" | "full";
  tgm: "none" | "text_ready" | "full";
  telegram: "none" | "text_ready" | "full";
  voice: "none" | "text_ready" | "full";
  operator: "none" | "text_ready" | "full";
  safeActions: boolean;
  protectedActions: boolean;
};

// -- Language lifecycle states --
export type LanguageLifecycleState =
  | "declare"
  | "understand"
  | "localize"
  | "validate"
  | "limited_rollout"
  | "promote";

// -- Safe degradation input --
export type SafeDegradationInput = {
  languageCode: string;
  surface: "web" | "tgm" | "telegram" | "voice" | "operator";
  uncertaintyType: "intent" | "entity" | "protected_action" | "voice_not_ready" | "surface_not_ready";
  fallbackLanguage?: string;
};

// -- Safe degradation result --
export type SafeDegradationResult = {
  action: "clarify" | "safe_text_fallback" | "limit_capability" | "switch_language" | "switch_channel" | "decline_action";
  targetLanguage?: string;
  reason: string;
  message?: string;
};

// -- Feature flag check input --
export type FeatureFlagCheckInput = {
  languageCode: string;
  surface: string;
  role: "creator" | "operator" | "user";
};

// -- Language registry --
export type LanguageRegistry = {
  packs: Map<string, LanguagePack>;
  activeLanguage: string;
  defaultLanguage: string;
};

// -- Minimal pack file set --
export type LanguagePackFiles = {
  manifest: string;       // manifest.json
  understanding: string;  // understanding.json
  ux: string;            // ux.json
  persona: string;       // persona.json
  validation: string;    // validation.json
  rollout: string;       // rollout.json
  voice?: string;        // voice.json (optional)
};
