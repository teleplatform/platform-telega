// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Personalization Profile
//
// Bounded personalization layer.
// System can adapt style, verbosity, continuity — but not become creepy.
// ─────────────────────────────────────────────────────────────

import type { ArishaPersonalizationProfile } from "./types.js";

export function buildArishaPersonalizationProfile(input?: {
  toneStyle?: ArishaPersonalizationProfile["toneStyle"];
  verbosity?: ArishaPersonalizationProfile["verbosity"];
  continuityLevel?: ArishaPersonalizationProfile["continuityLevel"];
  notes?: string[];
}): ArishaPersonalizationProfile {
  return {
    toneStyle: input?.toneStyle ?? "neutral",
    verbosity: input?.verbosity ?? "balanced",
    continuityLevel: input?.continuityLevel ?? "medium",
    notes: input?.notes,
  };
}

export function getDefaultPersonalizationProfile(): ArishaPersonalizationProfile {
  return buildArishaPersonalizationProfile();
}

export function getToneStyleDescription(style: ArishaPersonalizationProfile["toneStyle"]): string {
  switch (style) {
    case "neutral":
      return "Neutral tone — balanced, neither warm nor cold";
    case "warm":
      return "Warm tone — friendly, caring, but not overfamiliar";
    case "concise":
      return "Concise tone — brief, to the point, no extra words";
    case "supportive":
      return "Supportive tone — encouraging, helpful, empathetic";
    case "playful":
      return "Playful tone — light, humorous when appropriate";
    case "professional":
      return "Professional tone — respectful, competent, business-appropriate";
    default:
      return `Unknown tone style: ${style}`;
  }
}

export function getVerbosityDescription(verbosity: ArishaPersonalizationProfile["verbosity"]): string {
  switch (verbosity) {
    case "short":
      return "Short responses — 1-2 sentences maximum";
    case "balanced":
      return "Balanced responses — 2-4 sentences, appropriate detail";
    case "detailed":
      return "Detailed responses — fuller explanation when requested";
    default:
      return `Unknown verbosity: ${verbosity}`;
  }
}

export function getContinuityLevelDescription(level: ArishaPersonalizationProfile["continuityLevel"]): string {
  switch (level) {
    case "low":
      return "Low continuity — minimal carryover between turns";
    case "medium":
      return "Medium continuity — natural conversation flow maintained";
    case "high":
      return "High continuity — strong context carryover, user may notice memory use";
    default:
      return `Unknown continuity level: ${level}`;
  }
}
