// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Selectors
//
// getVoiceTransportContract()
// supportsHandoff()
// supportsFallback()
// supportsTransportInterruption()
// getMaxFallbackAttempts()
// getMaxTransportRetries()
// getSupportedVoiceTransportSurfaces()
// ─────────────────────────────────────────────────────────────

import type { VoiceTransportOrchestrationContract, VoiceTransportSurface } from "./types.js";

let _contract: VoiceTransportOrchestrationContract | null = null;

export function setVoiceTransportContract(contract: VoiceTransportOrchestrationContract): void {
  _contract = contract;
}

export function getVoiceTransportContract(): VoiceTransportOrchestrationContract | null {
  return _contract;
}

export function supportsHandoff(): boolean | undefined {
  return _contract?.supportsHandoff;
}

export function supportsFallback(): boolean | undefined {
  return _contract?.supportsFallback;
}

export function supportsTransportInterruption(): boolean | undefined {
  return _contract?.supportsTransportInterruption;
}

export function getMaxFallbackAttempts(): number | undefined {
  return _contract?.maxFallbackAttempts;
}

export function getMaxTransportRetries(): number | undefined {
  return _contract?.maxTransportRetries;
}

export function getSupportedVoiceTransportSurfaces(): VoiceTransportSurface[] | undefined {
  return _contract?.supportedSurfaces;
}

export function requiresSessionBinding(): boolean | undefined {
  return _contract?.requiresSessionBinding;
}

export function getContractVersion(): string | undefined {
  return _contract?.version;
}
