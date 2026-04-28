// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Builtin Adapter
//
// Production-grade publish registration adapter.
// All publish features enabled by default.
// ─────────────────────────────────────────────────────────────

import type { AliceSkillRegistrationAdapter } from "./types.js";
import { setAliceSkillRegistrationAdapter } from "./selectors.js";

export const aliceSkillRegistrationAdapter: AliceSkillRegistrationAdapter = {
  adapterId: "alice_publish_registration_v1",
  version: "1.0.0",
  supportsManifestGeneration: true,
  supportsInvocationProfile: true,
  supportsEnvironmentReadiness: true,
  supportsPublishValidation: true,
  supportsChecklistGeneration: true,
};

// Auto-register
setAliceSkillRegistrationAdapter(aliceSkillRegistrationAdapter);
