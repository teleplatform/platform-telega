// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Builtin Adapter
//
// Production-grade live ops adapter.
// All post-launch control features enabled by default.
// ─────────────────────────────────────────────────────────────

import type { AliceLiveOpsAdapter } from "./types.js";
import { setAliceLiveOpsAdapter } from "./selectors.js";

export const aliceLiveOpsAdapter: AliceLiveOpsAdapter = {
  adapterId: "alice_live_operations_v1",
  version: "1.0.0",
  supportsOperationalState: true,
  supportsLiveHealthSnapshot: true,
  supportsOperatorControls: true,
  supportsDegradeMode: true,
  supportsDisableMode: true,
  supportsAnomalySignals: true,
};

// Auto-register
setAliceLiveOpsAdapter(aliceLiveOpsAdapter);
