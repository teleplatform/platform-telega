// @ts-nocheck
export function isIntelEnabled(): boolean {
  return process.env.PANTHEON_INTEL_ENABLED === "1";
}

export function setIntelEnabled(on: boolean) {
  process.env.PANTHEON_INTEL_ENABLED = on ? "1" : "0";
}

export function getAllowedChatIds(): Set<string> {
  const raw = (process.env.PANTHEON_INTEL_CHAT_IDS || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function isChatAllowed(chatId: string | number, isPrivateChat: boolean): boolean {
  const allowed = getAllowedChatIds();
  if (allowed.size === 0) {
    return isPrivateChat;
  }
  return allowed.has(String(chatId));
}
