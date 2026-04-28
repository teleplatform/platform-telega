// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Builtin Adapter
//
// Production-grade incident/recovery adapter.
// All incident/recovery features enabled by default.
// ─────────────────────────────────────────────────────────────

import type { AliceIncidentRecoveryAdapter } from "./types.js";
import { setAliceIncidentRecoveryAdapter } from "./selectors.js";

export const aliceIncidentRecoveryAdapter: AliceIncidentRecoveryAdapter = {
  adapterId: "alice_incident_recovery_v1",
  version: "1.0.0",
  supportsIncidentState: true,
  supportsSeverityResolution: true,
  supportsRecoveryPlaybooks: true,
  supportsRecoveryDecisions: true,
  supportsRecoveryOutcome: true,
  supportsSafeRestoration: true,
};

// Auto-register
setAliceIncidentRecoveryAdapter(aliceIncidentRecoveryAdapter);
