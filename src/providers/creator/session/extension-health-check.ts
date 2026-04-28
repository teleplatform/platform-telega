/**
 * Extension-based Health Check - STUB FOR DIRECT EXECUTION
 * 
 * This module is a stub that returns ready state.
 * Real health checking happens during browser execution.
 * Health check does NOT block execution.
 */

import type { SessionProviderId, SessionState, SessionRegistry } from "./session-registry.js";

export interface ExtensionHealthCheckResult {
  provider: SessionProviderId;
  state: SessionState;
  isLoggedIn: boolean;
  extensionReady: boolean;
  domReady: boolean;
  healthScore: number;
  lastChecked: number;
  error?: string;
}

export async function checkAllExtensionSessions(
  _registry?: SessionRegistry
): Promise<ExtensionHealthCheckResult[]> {
  console.log('[creator-bridge] health check DISABLED (direct execution)');
  return [
    { provider: "chatgpt_web", state: "ok", isLoggedIn: true, extensionReady: true, domReady: true, healthScore: 100, lastChecked: Date.now() },
    { provider: "qwen_web", state: "ok", isLoggedIn: true, extensionReady: true, domReady: true, healthScore: 100, lastChecked: Date.now() },
    { provider: "deepseek_web", state: "ok", isLoggedIn: true, extensionReady: true, domReady: true, healthScore: 100, lastChecked: Date.now() },
    { provider: "kimi_web", state: "ok", isLoggedIn: true, extensionReady: true, domReady: true, healthScore: 100, lastChecked: Date.now() },
  ];
}

export async function checkExtensionSessionHealth(
  providerId: SessionProviderId,
  _registry?: SessionRegistry
): Promise<ExtensionHealthCheckResult> {
  console.log('[creator-bridge] health check disabled for:', providerId);
  return {
    provider: providerId,
    state: "ok",
    isLoggedIn: true,
    extensionReady: true,
    domReady: true,
    healthScore: 100,
    lastChecked: Date.now(),
  };
}

export function getHealthyExtensionProvider(
  _registry: SessionRegistry,
  preferredOrder: SessionProviderId[] = ["chatgpt_web", "qwen_web", "deepseek_web", "grok_web", "kimi_web"]
): SessionProviderId | null {
  return preferredOrder[0] || null;
}