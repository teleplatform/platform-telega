import type { BrowserAgentIntent, BrowserAgentPlan } from "./browser-agent.types.js";
import { assertBrowserAgentAllowed } from "./browser-agent-policy.js";
import { buildBrowserAgentEvidence } from "./browser-agent-evidence.js";

export async function routeBrowserAgentIntent(intent: BrowserAgentIntent): Promise<BrowserAgentPlan> {
  console.log("[browser-agent] intent_received", {
    intentId: intent.id,
    userId: intent.userId,
    mode: intent.mode,
    command: intent.command,
    target: intent.target,
  });

  assertBrowserAgentAllowed(intent);

  return {
    status: "planned",
    plan: [
      "resolve active browser context",
      "request consent if required",
      "execute action through bridge core",
      "confirm effect",
      "write evidence",
    ],
  };
}
