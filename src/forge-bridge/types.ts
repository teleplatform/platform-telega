// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Core Types
// ─────────────────────────────────────────────────────────────

// -- Status lattice --
export type ForgeBridgeBundleStatus =
  | "prepared"
  | "reviewable"
  | "approved_for_transfer"
  | "transferred"
  | "blocked";

// -- Source classification --
export type ForgeBundleSource =
  | "artifact_pipeline"
  | "execution_target"
  | "operator_request"
  | "telegrpt_surface"
  | "arisha_surface";

// -- Next-step markers (every bundle MUST carry one) --
export type ForgeBundleNextStep =
  | "operator_review"
  | "forge_ingest"
  | "forge_manual_open"
  | "wait_for_approval"
  | "blocked";

// -- Persona modes --
export type PersonaMode =
  | "arisha"
  | "system"
  | "operator"
  | "neutral";

// -- Supported language codes (ARISHA multilingual constraint) --
export type SupportedLanguageCode =
  | "ru"
  | "en"
  | "uz"
  | "de"
  | "fr"
  | "es"
  | "ja";

// -- Provenance contract --
export type ForgeBundleProvenance = {
  originSurface?: "telegram" | "web" | "tgm" | "voice" | "operator";
  originTarget?: string;
  taskId?: string;
  actorId?: string;
  actorRole?: string;
  pipelineState?: string;
  executionState?: string;
  receiptRefs?: string[];
};

// -- Review state contract --
export type ForgeBundleReviewState = {
  reviewStatus: "not_reviewed" | "reviewed" | "approved" | "blocked";
  reviewSummary?: string;
  reviewNotes?: string[];
};

// -- Persona context contract --
export type ForgeBundlePersonaContext = {
  personaMode: PersonaMode;
  personaId?: "arisha";
  voiceSurface?: "alice_bridge" | "telegram_voice" | "web_voice" | "none";
  toneClass?: "creator" | "user" | "neutral";
};

// -- Language context contract --
export type ForgeBundleLanguageContext = {
  resolvedLanguage: SupportedLanguageCode;
  requestedLanguage?: SupportedLanguageCode;
  profileLanguage?: SupportedLanguageCode;
  conversationLanguage?: SupportedLanguageCode;
  fallbackLanguage: "en";
  multilingualReady: boolean;
};

// -- Primary bundle contract (first-class object) --
export type ForgeBridgeBundle = {
  bundleId: string;
  artifactId: string;
  executionId?: string;
  traceId?: string;

  source: ForgeBundleSource;
  status: ForgeBridgeBundleStatus;
  nextStep: ForgeBundleNextStep;

  artifactType: string;
  intentClass: string;

  title: string;
  summary: string;

  payloadRef?: string;
  payloadInline?: Record<string, unknown>;

  provenance: ForgeBundleProvenance;
  review: ForgeBundleReviewState;
  language: ForgeBundleLanguageContext;
  persona: ForgeBundlePersonaContext;

  createdAt: string;
  updatedAt: string;
};

// -- Bundle event for append-only event log --
export type ForgeBridgeBundleEvent = {
  eventId: string;
  bundleId: string;
  eventType: ForgeBridgeBundleEventType;
  payload?: Record<string, unknown>;
  actorId?: string;
  actorRole?: string;
  createdAt: string;
};

export type ForgeBridgeBundleEventType =
  | "forge_bundle_created"
  | "forge_bundle_reviewed"
  | "forge_bundle_approved"
  | "forge_bundle_blocked"
  | "forge_bundle_transferred"
  | "forge_bundle_opened"
  | "forge_bundle_summary_built";

// -- Human-readable packet view (operator surface) --
export type ForgeBundlePacketView = {
  Title: string;
  Summary: string;
  Artifact: string;
  Source: ForgeBundleSource;
  Persona: PersonaMode;
  Language: SupportedLanguageCode;
  "Review status": ForgeBundleReviewState["reviewStatus"];
  "Next step": ForgeBundleNextStep;
  "Trace / provenance": string;
};

// -- Input shapes for service methods --
export type CreateBundleFromArtifactInput = {
  artifactId: string;
  artifactType: string;
  intentClass: string;
  title: string;
  summary: string;
  actorId?: string;
  actorRole?: string;
  taskId?: string;
  traceId?: string;
  originSurface?: ForgeBundleProvenance["originSurface"];
  requestedLanguage?: SupportedLanguageCode;
  profileLanguage?: SupportedLanguageCode;
  conversationLanguage?: SupportedLanguageCode;
  personaMode?: PersonaMode;
  payloadRef?: string;
  payloadInline?: Record<string, unknown>;
};

export type CreateBundleFromExecutionInput = {
  executionId: string;
  artifactId: string;
  artifactType: string;
  intentClass: string;
  title: string;
  summary: string;
  actorId?: string;
  actorRole?: string;
  taskId?: string;
  traceId?: string;
  executionState?: string;
  originSurface?: ForgeBundleProvenance["originSurface"];
  requestedLanguage?: SupportedLanguageCode;
  profileLanguage?: SupportedLanguageCode;
  conversationLanguage?: SupportedLanguageCode;
  personaMode?: PersonaMode;
  payloadRef?: string;
  payloadInline?: Record<string, unknown>;
};

export type ResolveLanguageInput = {
  requestedLanguage?: SupportedLanguageCode;
  conversationLanguage?: SupportedLanguageCode;
  profileLanguage?: SupportedLanguageCode;
  surfaceHint?: SupportedLanguageCode;
};

export type ResolvePersonaInput = {
  personaMode?: PersonaMode;
  personaId?: "arisha";
  voiceSurface?: ForgeBundlePersonaContext["voiceSurface"];
  toneClass?: ForgeBundlePersonaContext["toneClass"];
};

export type MarkBundleReviewedInput = {
  bundleId: string;
  reviewSummary?: string;
  reviewNotes?: string[];
};

export type MarkBundleApprovedInput = {
  bundleId: string;
};

export type MarkBundleTransferredInput = {
  bundleId: string;
  payloadRef?: string;
};

export type GetBundleInput = {
  bundleId: string;
};

export type ListRecentBundlesInput = {
  limit?: number;
};

export type GetBundlesByArtifactInput = {
  artifactId: string;
};
