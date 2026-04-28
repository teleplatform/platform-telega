// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Alice Ingress Hardening v1.0 + all prior Alice layers
//
// CORE DECISION: Publish readiness ≠ production success.
// This layer prepares launch-readiness metadata, not runtime behavior.
// ─────────────────────────────────────────────────────────────

// -- First-class skill identity --
export type AliceSkillIdentity = {
  skillId: "arisha_alice_skill_v1";
  displayName: string;
  personaId: "arisha";

  surface: "alice";
  primaryLanguage: "ru";
  supportedLanguages: ("ru" | "en" | "uz")[];

  shortDescription: string;
  longDescription?: string;
};

// -- Invocation profile --
export type AliceSkillInvocationProfile = {
  entryPhrases: string[];
  invocationMode: "voice_entry";
  requiresExplicitInvocation: boolean;

  defaultEntryIntent: "arisha_entry";
  supportsFollowupTurns: boolean;
  supportsSessionContinuation: boolean;
};

// -- Skill manifest (machine-readable launch contract) --
export type AliceSkillManifest = {
  manifestVersion: "1.0";
  identity: AliceSkillIdentity;
  invocation: AliceSkillInvocationProfile;

  webhookPath: string;
  httpMethod: "POST";
  contentType: "application/json";

  readiness: {
    ingressReady: boolean;
    protocolReady: boolean;
    bridgeReady: boolean;
    hardeningReady: boolean;
  };
};

// -- Publish readiness report --
export type AlicePublishReadinessReport = {
  readyToPublish: boolean;

  checks: {
    manifestValid: boolean;
    invocationValid: boolean;
    endpointConfigured: boolean;
    environmentReady: boolean;
    hardeningEnabled: boolean;
    requiredSecretsPresent: boolean;
  };

  blockers?: string[];
  warnings?: string[];
  notes?: string[];
};

// -- Registration adapter descriptor --
export type AliceSkillRegistrationAdapter = {
  adapterId: "alice_publish_registration_v1";
  version: string;

  supportsManifestGeneration: boolean;
  supportsInvocationProfile: boolean;
  supportsEnvironmentReadiness: boolean;
  supportsPublishValidation: boolean;
  supportsChecklistGeneration: boolean;
};

// -- ValidationError --
export type AlicePublishValidationError = {
  path: string;
  message: string;
};

// -- Checklist item --
export type AlicePublishChecklistItem = {
  id: string;
  label: string;
  status: "done" | "pending" | "blocked";
  note?: string;
};

// -- Release summary --
export type AliceReleaseSummary = {
  skillId: string;
  version: string;
  readyToPublish: boolean;
  manifestPath?: string;
  endpointPath?: string;
  blockers: string[];
  warnings: string[];
  notes: string[];
  generatedAt: string;
};
