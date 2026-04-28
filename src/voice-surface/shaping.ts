// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Response Shaping
//
// Limits length by surface, preserves truthfulness, preserves
// persona tone, prevents voice from becoming long, prevents
// telegram from becoming too heavy.
// ─────────────────────────────────────────────────────────────

import type { VoiceSurfaceResponseContract, ShapedResponse } from "./types.js";

export function shapeResponse(
  text: string,
  contract: VoiceSurfaceResponseContract,
): ShapedResponse {
  const maxSentences = contract.responseShape.maxSentences;

  // Split into sentences
  const sentences = text.match(/[^.!?]*[.!?]+/g) || [text];

  let truncated = false;
  let selected = sentences;

  if (sentences.length > maxSentences) {
    selected = sentences.slice(0, maxSentences);
    truncated = true;
  }

  return {
    text: selected.join(" ").trim(),
    sentenceCount: selected.length,
    truncated,
    surface: contract.surface,
  };
}

export function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : 1;
}

export function exceedsMaxSentences(text: string, contract: VoiceSurfaceResponseContract): boolean {
  return countSentences(text) > contract.responseShape.maxSentences;
}

export function countPrimaryIdeas(text: string): number {
  // Rough heuristic: count distinct clauses separated by semicolons or conjunctions
  const separators = text.match(/[,;]| but | and | however | though | although | потому что | что | чтобы /gi);
  return (separators?.length ?? 0) + 1;
}

export function exceedsMaxPrimaryIdeas(text: string, contract: VoiceSurfaceResponseContract): boolean {
  return countPrimaryIdeas(text) > contract.responseShape.maxPrimaryIdeas;
}

export function isWithinLimits(text: string, contract: VoiceSurfaceResponseContract): boolean {
  return !exceedsMaxSentences(text, contract) && !exceedsMaxPrimaryIdeas(text, contract);
}
