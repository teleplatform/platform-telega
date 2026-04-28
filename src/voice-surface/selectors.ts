// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Selectors
//
// getSurfaceContract(surface)
// getMaxSentences(surface)
// getDefaultLength(surface)
// shouldClarifyFirst(surface)
// supportsHoldingPhrase(surface)
// supportsInterruption(surface)
// ─────────────────────────────────────────────────────────────

import type {
  VoiceSurfaceResponseContract,
  VoiceSurfaceId,
} from "./types.js";

const _registry = new Map<VoiceSurfaceId, VoiceSurfaceResponseContract>();

export function registerSurface(contract: VoiceSurfaceResponseContract): void {
  _registry.set(contract.surface, contract);
}

export function getSurfaceContract(surface: VoiceSurfaceId): VoiceSurfaceResponseContract | undefined {
  return _registry.get(surface);
}

export function hasSurface(surface: VoiceSurfaceId): boolean {
  return _registry.has(surface);
}

export function listSurfaces(): VoiceSurfaceResponseContract[] {
  return Array.from(_registry.values());
}

export function getMaxSentences(surface: VoiceSurfaceId): number | undefined {
  return _registry.get(surface)?.responseShape.maxSentences;
}

export function getDefaultLength(surface: VoiceSurfaceId): "short" | "medium" | undefined {
  return _registry.get(surface)?.responseShape.defaultLength;
}

export function shouldClarifyFirst(surface: VoiceSurfaceId): boolean | undefined {
  return _registry.get(surface)?.turnTaking.clarifyBeforeAction;
}

export function supportsHoldingPhrase(surface: VoiceSurfaceId): boolean | undefined {
  return _registry.get(surface)?.latencyBehavior.supportsShortHoldingPhrase;
}

export function supportsInterruption(surface: VoiceSurfaceId): boolean | undefined {
  return _registry.get(surface)?.interruptionBehavior.supportsInterruption;
}

export function isVoiceStricterThan(surface: VoiceSurfaceId, other: VoiceSurfaceId): boolean {
  const a = _registry.get(surface);
  const b = _registry.get(other);
  if (!a || !b) return false;

  // Voice is stricter if it has lower maxSentences and lower maxPrimaryIdeas
  return a.responseShape.maxSentences < b.responseShape.maxSentences &&
    a.responseShape.maxPrimaryIdeas <= b.responseShape.maxPrimaryIdeas;
}

export function compareStrictness(a: VoiceSurfaceId, b: VoiceSurfaceId): number {
  const contractA = _registry.get(a);
  const contractB = _registry.get(b);
  if (!contractA || !contractB) return 0;

  // Lower maxSentences + lower maxPrimaryIdeas = stricter
  const aScore = contractA.responseShape.maxSentences + contractA.responseShape.maxPrimaryIdeas;
  const bScore = contractB.responseShape.maxSentences + contractB.responseShape.maxPrimaryIdeas;
  return aScore - bScore;
}
