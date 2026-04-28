import type { UserIntentPreference } from "./provider-ranking.js";
import { loadUserPreferences, saveUserPreferences, type StoredUserPreference } from "./persistence.js";

export type UserPreference = {
  defaultIntent: UserIntentPreference | undefined;
  explainMode: "short" | "full";
  creatorEnabled: boolean;
  lastUpdated: number;
};

const MAX_USERS = 10000;
const userPreferences = new Map<string, UserPreference>();
let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  
  const stored = loadUserPreferences();
  for (const pref of stored) {
    userPreferences.set(pref.userId, {
      defaultIntent: pref.defaultIntent,
      explainMode: pref.explainMode || "short",
      creatorEnabled: pref.creatorEnabled || false,
      lastUpdated: pref.lastUpdated,
    });
  }
  initialized = true;
  console.log(`[user-preferences] Loaded ${stored.length} preferences from disk`);
}

function persistPreferences(): void {
  const prefs: StoredUserPreference[] = [];
  for (const [userId, pref] of userPreferences.entries()) {
    prefs.push({
      userId,
      defaultIntent: pref.defaultIntent,
      explainMode: pref.explainMode,
      creatorEnabled: pref.creatorEnabled,
      lastUpdated: pref.lastUpdated,
    });
  }
  saveUserPreferences(prefs);
}

export function getUserPreference(userId: string): UserPreference {
  ensureInitialized();
  return userPreferences.get(userId) || {
    defaultIntent: undefined,
    explainMode: "short",
    creatorEnabled: false,
    lastUpdated: Date.now(),
  };
}

export function setUserPreference(userId: string, pref: Partial<UserPreference>): void {
  ensureInitialized();
  const current = getUserPreference(userId);
  const updated: UserPreference = {
    ...current,
    ...pref,
    lastUpdated: Date.now(),
  };
  
  userPreferences.set(userId, updated);
  
  if (userPreferences.size > MAX_USERS) {
    const firstKey = userPreferences.keys().next().value;
    if (firstKey) userPreferences.delete(firstKey);
  }
  
  persistPreferences();
}

export function setDefaultIntent(userId: string, intent: UserIntentPreference): void {
  setUserPreference(userId, { defaultIntent: intent });
}

export function setExplainMode(userId: string, mode: "short" | "full"): void {
  setUserPreference(userId, { explainMode: mode });
}

export function setCreatorEnabled(userId: string, enabled: boolean): void {
  setUserPreference(userId, { creatorEnabled: enabled });
}

export function clearUserPreference(userId: string): void {
  ensureInitialized();
  userPreferences.delete(userId);
  persistPreferences();
}

export function getUserIntentPreference(userId: string): UserIntentPreference | undefined {
  return getUserPreference(userId).defaultIntent;
}

export function getUserExplainMode(userId: string): "short" | "full" {
  return getUserPreference(userId).explainMode;
}

export function isUserCreatorEnabled(userId: string): boolean {
  return getUserPreference(userId).creatorEnabled;
}