// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Turn-Taking Logic
//
// Rules:
// - No more than one explicit next step by default
// - No more than one clarification per turn
// - Clarify-first on dangerous ambiguity
// - Voice doesn't go into long monologues
// ─────────────────────────────────────────────────────────────

import type { TurnTakingContract, VoiceSurfaceResponseContract } from "./types.js";

export function shouldClarifyBeforeAction(contract: VoiceSurfaceResponseContract): boolean {
  return contract.turnTaking.clarifyBeforeAction;
}

export function shouldClarifyBeforeProtectedMeaning(contract: VoiceSurfaceResponseContract): boolean {
  return contract.turnTaking.clarifyBeforeProtectedMeaning;
}

export function prefersImmediateAnswer(contract: VoiceSurfaceResponseContract): boolean {
  return contract.turnTaking.prefersImmediateAnswer;
}

export function allowsFollowupPrompt(contract: VoiceSurfaceResponseContract): boolean {
  return contract.turnTaking.allowsFollowupPrompt;
}

export function getFollowupPromptMaxCount(contract: VoiceSurfaceResponseContract): number {
  return contract.turnTaking.followupPromptMaxCount;
}

export function validateTurnBehavior(
  contract: VoiceSurfaceResponseContract,
  response: {
    nextSteps: number;
    clarifications: number;
    semanticAxes: number;
  },
): string[] {
  const violations: string[] = [];

  if (response.nextSteps > 1 && contract.responseShape.prefersSingleNextStep) {
    violations.push(
      `${contract.surface}: prefers single next step, got ${response.nextSteps}`,
    );
  }

  if (response.clarifications > 1) {
    violations.push(
      `${contract.surface}: no more than one clarification per turn, got ${response.clarifications}`,
    );
  }

  if (response.semanticAxes > contract.responseShape.maxPrimaryIdeas) {
    violations.push(
      `${contract.surface}: exceeds maxPrimaryIdeas (${contract.responseShape.maxPrimaryIdeas}), got ${response.semanticAxes}`,
    );
  }

  return violations;
}
