// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Selectors
//
// getAliceSkillRegistrationAdapter()
// supportsManifestGeneration()
// supportsInvocationProfile()
// supportsEnvironmentReadiness()
// supportsPublishValidation()
// supportsChecklistGeneration()
// ─────────────────────────────────────────────────────────────

import type { AliceSkillRegistrationAdapter } from "./types.js";

let _adapter: AliceSkillRegistrationAdapter | null = null;

export function setAliceSkillRegistrationAdapter(adapter: AliceSkillRegistrationAdapter): void {
  _adapter = adapter;
}

export function getAliceSkillRegistrationAdapter(): AliceSkillRegistrationAdapter | null {
  return _adapter;
}

export function supportsManifestGeneration(): boolean | undefined {
  return _adapter?.supportsManifestGeneration;
}

export function supportsInvocationProfile(): boolean | undefined {
  return _adapter?.supportsInvocationProfile;
}

export function supportsEnvironmentReadiness(): boolean | undefined {
  return _adapter?.supportsEnvironmentReadiness;
}

export function supportsPublishValidation(): boolean | undefined {
  return _adapter?.supportsPublishValidation;
}

export function supportsChecklistGeneration(): boolean | undefined {
  return _adapter?.supportsChecklistGeneration;
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
