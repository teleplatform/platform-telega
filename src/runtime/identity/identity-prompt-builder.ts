import { getFullSystemPrompt, getIdentitySummary } from "./runtime-identity.js";
import { getFacts } from "./runtime-facts.js";
import { evaluateMessage } from "./anti-drift-policy.js";
import type { AntiDriftResult } from "./anti-drift-policy.js";

export interface IdentityContext {
  userId: string;
  role: string;
  provider: string;
  model: string;
  isCreator: boolean;
}

export interface BuiltPrompt {
  system: string;
  identitySummary: string;
  antiDrift: AntiDriftResult | null;
  facts: string;
}

export function buildRuntimePrompt(context: IdentityContext): BuiltPrompt {
  const facts = getFacts().map(f => `- ${f.key}: ${f.value}`).join("\n");
  const system = getFullSystemPrompt();
  const identitySummary = getIdentitySummary();

  return {
    system,
    identitySummary,
    antiDrift: null,
    facts,
  };
}

export function buildRuntimePromptForMessage(
  userMessage: string,
  context: IdentityContext,
): BuiltPrompt {
  const antiDrift = evaluateMessage(userMessage);
  const facts = getFacts().map(f => `- ${f.key}: ${f.value}`).join("\n");
  const identitySummary = getIdentitySummary();

  let system: string;
  if (antiDrift.systemPromptOverride) {
    system = antiDrift.systemPromptOverride;
  } else {
    system = getFullSystemPrompt();
  }

  return {
    system,
    identitySummary,
    antiDrift: antiDrift.shouldBlock ? antiDrift : null,
    facts,
  };
}
