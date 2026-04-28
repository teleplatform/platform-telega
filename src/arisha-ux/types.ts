// ─────────────────────────────────────────────────────────────
// ARISHA LANGUAGE UX FILES v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Persona Entry, Multilingual Strategy, Stability Architecture,
//             Language Pack Contract, Voice UX Pack
//
// CORE DECISION: Language UX file = не "перевод фраз", а executable UX layer личности Ариши.
// One Persona / Different Language Expression / Same Character.
// ─────────────────────────────────────────────────────────────

// -- First-class object --
export type ArishaLanguageUxFile = {
  languageCode: ArishaSupportedLanguage;
  version: string;

  personaId: "arisha";
  status: ArishaUxStatus;

  modeVariants: {
    creator: ArishaUxModePack;
    user: ArishaUxModePack;
    neutral: ArishaUxModePack;
  };

  runtimeTruth: ArishaRuntimeTruthPack;
  fallback: ArishaFallbackPack;
  surfaceBehavior: ArishaSurfaceBehaviorPack;

  notes?: string[];
};

export type ArishaSupportedLanguage = "ru" | "en" | "uz";

export type ArishaUxStatus = "draft" | "validated" | "production";

// -- PhraseSet contract --
export type PhraseSet = {
  short: string[];
  medium: string[];
  long?: string[];
};

// -- Mode pack contract --
export type ArishaUxModePack = {
  greetings: PhraseSet;
  confirmations: PhraseSet;
  clarifications: PhraseSet;
  explanations: PhraseSet;
  help: PhraseSet;
  blocked: PhraseSet;
  safeFailure: PhraseSet;
  encouragementSoft?: PhraseSet;
};

// -- Runtime truth pack --
// CRITICAL: must NOT mix up statuses. Each is distinct.
export type ArishaRuntimeTruthPack = {
  prepared: PhraseSet;
  handedOff: PhraseSet;
  transferred: PhraseSet;
  delivered: PhraseSet;
  executed: PhraseSet;
  blocked: PhraseSet;
  reviewRequired: PhraseSet;
};

// -- Fallback pack --
export type ArishaFallbackPack = {
  languageUncertain: PhraseSet;
  intentUncertain: PhraseSet;
  surfaceLimited: PhraseSet;
  voiceUnavailable: PhraseSet;
  safeDowngrade: PhraseSet;
};

// -- Surface behavior pack --
export type ArishaSurfaceBehaviorPack = {
  web: SurfaceResponseProfile;
  tgm: SurfaceResponseProfile;
  telegram: SurfaceResponseProfile;
  voice: SurfaceResponseProfile;
};

// -- Surface response profile --
export type SurfaceResponseProfile = {
  defaultLength: "short" | "medium";
  maxSentences: number;
  prefersDirectness: boolean;
  prefersClarifyFirst: boolean;
};

// -- Selector input types --
export type PickPhraseInput = {
  languageCode: ArishaSupportedLanguage;
  mode?: "creator" | "user" | "neutral";
  surface?: keyof ArishaSurfaceBehaviorPack;
  length?: "short" | "medium" | "long";
};

// -- Validation error --
export type ArishaUxValidationError = {
  path: string;
  message: string;
};
