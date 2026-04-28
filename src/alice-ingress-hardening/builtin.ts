// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Builtin Adapter
//
// Production-grade hardening adapter for Alice ingress.
// All hardening features enabled by default.
// ─────────────────────────────────────────────────────────────

import type { AliceIngressHardeningAdapter } from "./types.js";
import { setAliceIngressHardeningAdapter } from "./selectors.js";

export const aliceIngressHardeningAdapter: AliceIngressHardeningAdapter = {
  adapterId: "alice_ingress_hardening_v1",
  version: "1.0.0",
  supportsSharedSecretCheck: true,
  supportsReplayProtection: true,
  supportsFingerprinting: true,
  supportsRateLimitHooks: true,
  supportsAuditTrail: true,
  supportsObservability: true,
  supportsSafeLogging: true,
};

// Auto-register
setAliceIngressHardeningAdapter(aliceIngressHardeningAdapter);
