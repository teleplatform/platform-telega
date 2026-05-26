import { getMemory, setMemory } from "./runtime-memory-store.js";

export interface CreatorProfile {
  userId: string;
  role: string;
  firstSeen: number;
  lastSeen: number;
  interactionCount: number;
  preferredProvider: string;
  preferredModel: string;
}

export function getCreatorProfile(userId: string): CreatorProfile {
  const mem = getMemory(`creator.${userId}.profile`);
  if (mem?.value) {
    return mem.value as CreatorProfile;
  }
  return {
    userId,
    role: "creator",
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    interactionCount: 0,
    preferredProvider: "ollama",
    preferredModel: "qwen2.5:7b-instruct",
  };
}

export function updateCreatorInteraction(userId: string): void {
  const profile = getCreatorProfile(userId);
  profile.lastSeen = Date.now();
  profile.interactionCount++;
  if (profile.interactionCount === 1) {
    profile.firstSeen = Date.now();
  }
  setMemory(`creator.${userId}.profile`, profile, "relationships", true);
}

export function updateCreatorPreferences(
  userId: string,
  prefs: Partial<Pick<CreatorProfile, "preferredProvider" | "preferredModel">>,
): void {
  const profile = getCreatorProfile(userId);
  if (prefs.preferredProvider) profile.preferredProvider = prefs.preferredProvider;
  if (prefs.preferredModel) profile.preferredModel = prefs.preferredModel;
  setMemory(`creator.${userId}.profile`, profile, "relationships", true);
}

export function getCreatorSummary(userId: string): string {
  const profile = getCreatorProfile(userId);
  return [
    `Creator ${profile.userId}`,
    `Role: ${profile.role}`,
    `Interactions: ${profile.interactionCount}`,
    `First seen: ${new Date(profile.firstSeen).toISOString()}`,
    `Last seen: ${new Date(profile.lastSeen).toISOString()}`,
    `Preferred: ${profile.preferredProvider} / ${profile.preferredModel}`,
  ].join("\n");
}
