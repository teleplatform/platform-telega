// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Builtin Adapter
//
// Production-grade go-live adapter.
// All launch features enabled by default.
// ─────────────────────────────────────────────────────────────

import type { AliceGoLiveAdapter } from "./types.js";
import { setAliceGoLiveAdapter } from "./selectors.js";

export const aliceGoLiveAdapter: AliceGoLiveAdapter = {
  adapterId: "alice_external_launch_v1",
  version: "1.0.0",
  supportsLaunchPlan: true,
  supportsGateValidation: true,
  supportsSmokeChecks: true,
  supportsControlledModes: true,
  supportsRollbackDiscipline: true,
  supportsLaunchOutcomeTracking: true,
};

// Auto-register
setAliceGoLiveAdapter(aliceGoLiveAdapter);
