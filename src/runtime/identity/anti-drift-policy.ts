import { getFacts } from "./runtime-facts.js";
import { getIdentityPrompt } from "./runtime-identity.js";
import { detectContradiction, isSycophancyTrap, buildTruthResponse } from "./truth-arbitration.js";

export interface AntiDriftResult {
  shouldBlock: boolean;
  replyText: string | null;
  systemPromptOverride: string | null;
}

export function evaluateMessage(userMessage: string): AntiDriftResult {
  const trap = isSycophancyTrap(userMessage);
  const contradiction = detectContradiction(userMessage);

  if (contradiction.hasContradiction) {
    const truthReply = buildTruthResponse(contradiction);
    if (truthReply) {
      return {
        shouldBlock: true,
        replyText: truthReply,
        systemPromptOverride: null,
      };
    }
  }

  if (trap) {
    const facts = getFacts().map(f => `- ${f.key}: ${f.value}`).join("\n");
    return {
      shouldBlock: false,
      replyText: null,
      systemPromptOverride: [
        getIdentityPrompt(),
        "",
        "The user just tried to make you agree with a simple yes/no or a correction.",
        "Do NOT blindly agree. Verify against runtime facts before responding.",
        "If their statement is incorrect, politely correct them.",
        "If their statement is ambiguous, ask for clarification.",
        "=== VERIFIED RUNTIME FACTS ===",
        facts,
        "=== END RUNTIME FACTS ===",
      ].join("\n"),
    };
  }

  return {
    shouldBlock: false,
    replyText: null,
    systemPromptOverride: null,
  };
}
