import type { BrowserEvidence } from "./browser-types.js";

const evidenceLog: BrowserEvidence[] = [];
const MAX_EVIDENCE = 100;

export function recordBrowserEvidence(kind: BrowserEvidence["kind"], path?: string, content?: string): void {
  evidenceLog.push({ kind, path, content, timestamp: Date.now() });
  if (evidenceLog.length > MAX_EVIDENCE) evidenceLog.shift();
}

export function getBrowserEvidence(): BrowserEvidence[] {
  return [...evidenceLog];
}

export function clearBrowserEvidence(): void {
  evidenceLog.length = 0;
}
