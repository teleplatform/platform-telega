/**
 * TGR-6.37 — Voice/Text Reply Choice Layer
 *
 * Manages pending voice replies and user reply mode preferences.
 *
 * Flow: LLM responds → pending reply created → inline buttons shown
 *   → user taps 🔊 Голосом → TTS → voice message
 *   → user taps 📝 Текстом → text message
 */

export type ReplyMode = "ask" | "voice" | "text";
export type VoiceReplyAction = "voice" | "text";

export interface ParsedVoiceReplyCallback {
  action: VoiceReplyAction;
  traceId: string;
}

export interface PendingVoiceReply {
  traceId: string;
  userId: string;
  chatId: string;
  text: string;
  language: string;
  createdAt: number;
}

const pendingReplies = new Map<string, PendingVoiceReply>();
const userReplyModes = new Map<string, ReplyMode>();

const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Pending reply operations ──────────────────────────────────────

export function createPendingVoiceReply(
  traceId: string,
  userId: string,
  chatId: string,
  text: string,
  language: string,
): void {
  gcPendingReplies();
  pendingReplies.set(traceId, {
    traceId,
    userId,
    chatId,
    text,
    language,
    createdAt: Date.now(),
  });
}

export function getPendingVoiceReply(traceId: string): PendingVoiceReply | undefined {
  const reply = pendingReplies.get(traceId);
  if (!reply) return undefined;
  if (Date.now() - reply.createdAt > PENDING_TTL_MS) {
    pendingReplies.delete(traceId);
    return undefined;
  }
  return reply;
}

export function resolvePendingVoiceReply(traceId: string): void {
  pendingReplies.delete(traceId);
}

function gcPendingReplies(): void {
  const now = Date.now();
  for (const [k, v] of pendingReplies.entries()) {
    if (now - v.createdAt > PENDING_TTL_MS) {
      pendingReplies.delete(k);
    }
  }
}

// ── User reply mode operations ────────────────────────────────────

export function setUserReplyMode(userId: string, mode: ReplyMode): void {
  userReplyModes.set(userId, mode);
}

export function getUserReplyMode(userId: string): ReplyMode {
  return userReplyModes.get(userId) ?? "ask";
}

// ── Callback routing (TGR-6.76) ───────────────────────────────────

export function buildVoiceReplyCallback(action: VoiceReplyAction, traceId: string): string {
  return `voice_reply:${action}:${traceId}`;
}

/** Parses voice_reply:voice:<id>, voice_reply:text:<id>, and legacy voice_send:/text_send: formats. */
export function parseVoiceReplyCallback(data: string): ParsedVoiceReplyCallback | null {
  const modern = data.match(/^voice_reply:(voice|text):(.+)$/);
  if (modern) {
    return { action: modern[1] as VoiceReplyAction, traceId: modern[2] };
  }

  const legacyVoice = data.match(/^voice_send:(.+)$/);
  if (legacyVoice) {
    return { action: "voice", traceId: legacyVoice[1] };
  }

  const legacyText = data.match(/^text_send:(.+)$/);
  if (legacyText) {
    return { action: "text", traceId: legacyText[1] };
  }

  return null;
}
