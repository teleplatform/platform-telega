// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Builtin Adapter
//
// Production-grade trust/safety adapter.
// All conversational safety features enabled by default.
// ─────────────────────────────────────────────────────────────

import type { AliceTrustSafetyAdapter } from "./types.js";
import { setAliceTrustSafetyAdapter } from "./selectors.js";

export const aliceTrustSafetyAdapter: AliceTrustSafetyAdapter = {
  adapterId: "alice_trust_safety_v1",
  version: "1.0.0",
  supportsRiskClassification: true,
  supportsTrustBoundaries: true,
  supportsRefusalDiscipline: true,
  supportsSafeMode: true,
  supportsSensitiveIntentHandling: true,
  supportsVoiceSafeShaping: true,
};

// Auto-register
setAliceTrustSafetyAdapter(aliceTrustSafetyAdapter);
