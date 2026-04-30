import type { BrowserAgentIntent, BrowserAgentAction } from "./browser-agent.types.js";

const CONSENT_REQUIRED_ACTIONS: BrowserAgentAction[] = [
  "click",
  "navigate",
  "close_tab",
  "open_tab",
  "dom_modify",
];

const PUBLIC_ALLOWED_ACTIONS: BrowserAgentAction[] = [
  "summary",
  "highlight",
  "search",
  "dom_read",
];

export function isConsentRequired(action: BrowserAgentAction): boolean {
  return CONSENT_REQUIRED_ACTIONS.includes(action);
}

export function isActionAllowedForMode(action: BrowserAgentAction, mode: "public" | "creator"): boolean {
  if (mode === "creator") return true;
  return PUBLIC_ALLOWED_ACTIONS.includes(action);
}

export function assertBrowserAgentAllowed(intent: BrowserAgentIntent): void {
  console.log("[browser-agent] policy_allowed", {
    intentId: intent.id,
    userId: intent.userId,
    mode: intent.mode,
    command: intent.command,
  });

  if (intent.action && !isActionAllowedForMode(intent.action, intent.mode)) {
    const err = new Error(
      `Browser agent action "${intent.action}" not allowed in "${intent.mode}" mode. ` +
      `Public mode only allows: ${PUBLIC_ALLOWED_ACTIONS.join(", ")}`
    );
    (err as any).code = "BROWSER_AGENT_POLICY_DENIED";
    throw err;
  }

  if (intent.action && isConsentRequired(intent.action)) {
    console.log("[browser-agent] consent_required", {
      intentId: intent.id,
      action: intent.action,
    });
    intent.requiresConsent = true;
  }
}
