// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Builtin Adapter
//
// Production-grade HTTP entry adapter for Alice ingress.
// ─────────────────────────────────────────────────────────────

import type { AliceHttpEntryAdapter } from "./types.js";
import { setAliceHttpEntryAdapter } from "./selectors.js";

export const aliceHttpEntryAdapter: AliceHttpEntryAdapter = {
  adapterId: "alice_http_entry_adapter_v1",
  version: "1.0.0",
  supportsPostOnly: true,
  supportsJsonOnly: true,
  supportsBoundaryValidation: true,
  supportsBasicVerificationGate: true,
  supportsProtocolHandOff: true,
};

// Auto-register
setAliceHttpEntryAdapter(aliceHttpEntryAdapter);
