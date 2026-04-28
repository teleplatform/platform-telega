// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Selectors
//
// getAliceBridgeAdapter()
// supportsArishaEntryDetection()
// supportsSessionBinding()
// supportsTransportTruth()
// supportsFallbackToTextSurface()
// getSupportedEntryPatterns(languageCode)
// ─────────────────────────────────────────────────────────────

import type { AliceVoiceBridgeAdapter, EntryPattern } from "./types.js";

let _adapter: AliceVoiceBridgeAdapter | null = null;
let _entryPatterns: EntryPattern[] = [];

export function setAliceBridgeAdapter(adapter: AliceVoiceBridgeAdapter): void {
  _adapter = adapter;
}

export function setSupportedEntryPatterns(patterns: EntryPattern[]): void {
  _entryPatterns = patterns;
}

export function getAliceBridgeAdapter(): AliceVoiceBridgeAdapter | null {
  return _adapter;
}

export function supportsArishaEntryDetection(): boolean | undefined {
  return _adapter?.supportsArishaEntryDetection;
}

export function supportsSessionBinding(): boolean | undefined {
  return _adapter?.supportsSessionBinding;
}

export function supportsTransportTruth(): boolean | undefined {
  return _adapter?.supportsTransportTruth;
}

export function supportsFallbackToTextSurface(): boolean | undefined {
  return _adapter?.supportsFallbackToTextSurface;
}

export function getSupportedEntryPatterns(languageCode?: "ru" | "en" | "uz"): EntryPattern[] {
  if (!languageCode) return _entryPatterns;
  return _entryPatterns.filter((p) => p.languageCode === languageCode);
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
