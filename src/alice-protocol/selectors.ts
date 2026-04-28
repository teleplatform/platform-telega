// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Selectors
//
// getAliceProtocolAdapter()
// supportsProtocolValidation()
// supportsRequestNormalization()
// supportsResponseMapping()
// supportsTruthfulEndSession()
// getSafeProtocolVersion()
// ─────────────────────────────────────────────────────────────

import type { AliceProtocolAdapter } from "./types.js";

let _adapter: AliceProtocolAdapter | null = null;
const SAFE_PROTOCOL_VERSION = "1.0";

export function setAliceProtocolAdapter(adapter: AliceProtocolAdapter): void {
  _adapter = adapter;
}

export function getAliceProtocolAdapter(): AliceProtocolAdapter | null {
  return _adapter;
}

export function supportsProtocolValidation(): boolean | undefined {
  return _adapter?.supportsProtocolValidation;
}

export function supportsRequestNormalization(): boolean | undefined {
  return _adapter?.supportsRequestNormalization;
}

export function supportsResponseMapping(): boolean | undefined {
  return _adapter?.supportsResponseMapping;
}

export function supportsTruthfulEndSession(): boolean | undefined {
  return _adapter?.supportsTruthfulEndSession;
}

export function getSafeProtocolVersion(): string {
  return SAFE_PROTOCOL_VERSION;
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
