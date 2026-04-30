import type { BrowserAgentEvidence, BrowserAgentEffect, BrowserAgentSurface } from "./browser-agent.types.js";

export function buildBrowserAgentEvidence(params: {
  intent: string;
  target: string;
  action: string;
  effect: BrowserAgentEffect;
  evidence: string;
  surface?: BrowserAgentSurface;
}): BrowserAgentEvidence {
  const record: BrowserAgentEvidence = {
    intent: params.intent,
    target: params.target,
    action: params.action,
    effect: params.effect,
    evidence: params.evidence,
    timestamp: new Date().toISOString(),
    surface: params.surface || "browser",
  };

  console.log("[browser-agent] evidence_created", {
    intent: record.intent,
    action: record.action,
    effect: record.effect,
    timestamp: record.timestamp,
  });

  return record;
}
