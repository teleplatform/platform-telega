// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Skill Identity
//
// First-class explicit identity for the Alice/Arisha skill.
// Not hidden in internal modules — this is the public-facing identity.
// ─────────────────────────────────────────────────────────────

import type { AliceSkillIdentity } from "./types.js";

export function buildAliceSkillIdentity(input?: {
  displayName?: string;
  shortDescription?: string;
  longDescription?: string;
  supportedLanguages?: ("ru" | "en" | "uz")[];
}): AliceSkillIdentity {
  return {
    skillId: "arisha_alice_skill_v1",
    displayName: input?.displayName ?? "Ариша",
    personaId: "arisha",
    surface: "alice",
    primaryLanguage: "ru",
    supportedLanguages: input?.supportedLanguages ?? ["ru", "en", "uz"],
    shortDescription: input?.shortDescription ?? "Голосовой ассистент Ариша — живой, спокойный, надёжный.",
    longDescription: input?.longDescription,
  };
}

export function getDefaultAliceSkillIdentity(): AliceSkillIdentity {
  return buildAliceSkillIdentity();
}
