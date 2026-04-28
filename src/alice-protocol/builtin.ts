// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Builtin Adapter
//
// Production-grade protocol adapter between Alice envelope and
// Alice bridge adapter.
// ─────────────────────────────────────────────────────────────

import type { AliceProtocolAdapter } from "./types.js";
import { setAliceProtocolAdapter } from "./selectors.js";

export const aliceProtocolAdapter: AliceProtocolAdapter = {
  adapterId: "alice_protocol_adapter_v1",
  version: "1.0.0",
  supportsProtocolValidation: true,
  supportsRequestNormalization: true,
  supportsResponseMapping: true,
  supportsTruthfulEndSession: true,
};

// Auto-register
setAliceProtocolAdapter(aliceProtocolAdapter);
