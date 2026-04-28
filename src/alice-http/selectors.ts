// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Selectors
//
// getAliceHttpEntryAdapter()
// supportsPostOnly()
// supportsJsonOnly()
// supportsBoundaryValidation()
// supportsBasicVerificationGate()
// supportsProtocolHandOff()
// ─────────────────────────────────────────────────────────────

import type { AliceHttpEntryAdapter } from "./types.js";

let _adapter: AliceHttpEntryAdapter | null = null;

export function setAliceHttpEntryAdapter(adapter: AliceHttpEntryAdapter): void {
  _adapter = adapter;
}

export function getAliceHttpEntryAdapter(): AliceHttpEntryAdapter | null {
  return _adapter;
}

export function supportsPostOnly(): boolean | undefined {
  return _adapter?.supportsPostOnly;
}

export function supportsJsonOnly(): boolean | undefined {
  return _adapter?.supportsJsonOnly;
}

export function supportsBoundaryValidation(): boolean | undefined {
  return _adapter?.supportsBoundaryValidation;
}

export function supportsBasicVerificationGate(): boolean | undefined {
  return _adapter?.supportsBasicVerificationGate;
}

export function supportsProtocolHandOff(): boolean | undefined {
  return _adapter?.supportsProtocolHandOff;
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
