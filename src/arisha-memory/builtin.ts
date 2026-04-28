// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Builtin Adapter
//
// Production-grade memory/personalization trust adapter.
// All memory/personalization features enabled by default.
// ─────────────────────────────────────────────────────────────

import type { ArishaMemoryTrustAdapter } from "./types.js";
import { setArishaMemoryTrustAdapter } from "./selectors.js";

export const arishaMemoryTrustAdapter: ArishaMemoryTrustAdapter = {
  adapterId: "arisha_memory_personalization_trust_v1",
  version: "1.0.0",
  supportsMemoryBoundary: true,
  supportsMemoryUsageDecisions: true,
  supportsPersonalizationProfiles: true,
  supportsToneAdaptation: true,
  supportsContinuityDecisions: true,
  supportsDormantMemoryHandling: true,
};

// Auto-register
setArishaMemoryTrustAdapter(arishaMemoryTrustAdapter);
