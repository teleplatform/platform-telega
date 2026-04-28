import { generateConsentToken, validateConsentToken } from "../security/consent-token.js";
import { isOwnerCreator, hasCapability } from "../core/auth/runtime-access.js";

const enabledCreatorBridgeUsers = new Set<string>();
const creatorBridgeConsentTokens = new Map<string, string>();

export function isCreatorActor(userId: string | number, isPrivateChat: boolean): boolean {
  return isOwnerCreator(userId);
}

export function isCreatorBridgeAllowed(userId: string | number, isPrivateChat: boolean): boolean {
  return hasCapability(userId, "creator_bridge_use");
}

export function setCreatorBridgeEnabled(userId: string | number, enabled: boolean): void {
  const key = String(userId);
  if (enabled) {
    enabledCreatorBridgeUsers.add(key);
    creatorBridgeConsentTokens.set(key, generateConsentToken(key));
    return;
  }
  enabledCreatorBridgeUsers.delete(key);
  creatorBridgeConsentTokens.delete(key);
}

export function isCreatorBridgeEnabled(userId: string | number): boolean {
  return enabledCreatorBridgeUsers.has(String(userId));
}

export function getCreatorBridgeStatus(userId: string | number): "on" | "off" {
  return isCreatorBridgeEnabled(userId) ? "on" : "off";
}

export function getCreatorBridgeConsentToken(userId: string | number): string | undefined {
  const token = creatorBridgeConsentTokens.get(String(userId));
  return validateConsentToken(token) ? token : undefined;
}

export function resolveCreatorBridgeTarget(): "local" | "openai" {
  const configured = (process.env.CREATOR_BRIDGE_PROVIDER_TARGET || "local").trim().toLowerCase();
  return configured === "openai" ? "openai" : "local";
}
