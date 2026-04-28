/**
 * Voice Interruption / Barge-In Layer v1.0
 *
 * Bounded turn-supersession / stale-prevention layer.
 * Ensures stale voice responses are never delivered after a newer user turn.
 *
 * NOT a live barge-in audio engine. NOT a streaming interruption system.
 * This is a deterministic pre-send stale-check gate.
 *
 * Statuses:
 *   active        — voice is being prepared for the current turn
 *   superseded    — a newer user turn arrived; this voice is stale
 *   cancelled     — voice send was explicitly cancelled
 *   safe_to_send  — voice is current and safe to deliver
 *
 * This layer does NOT:
 *   - Capture live microphone input
 *   - Interrupt mid-playback audio
 *   - Use websocket/RTP/VoIP streams
 *   - Rewrite TTS engine or provider contracts
 */

export type VoiceInterruptionStatus =
  | "active"
  | "superseded"
  | "cancelled"
  | "safe_to_send";

export interface VoiceInterruptionContext {
  chatId: string;
  sourceUserMessageId: number | string;
  sourceTurnKey: string;
  createdAtMs: number;
}

export interface VoiceInterruptionDecision {
  status: VoiceInterruptionStatus;
  shouldCancelVoiceSend: boolean;
  shouldAllowVoiceSend: boolean;
  wasSuperseded: boolean;
  supersededByMessageId: number | string | null;
  supersededByTurnKey: string | null;
  hints: string[];
  warnings: string[];
}

// ============================================================================
// Minimal bounded in-memory turn registry
// ============================================================================

type ChatTurnState = {
  latestUserMessageId: number | string | null;
  latestTurnKey: string | null;
  updatedAtMs: number;
};

const latestChatTurnMap = new Map<string, ChatTurnState>();

/**
 * Register the latest user turn for a chat.
 * Called immediately on incoming user message.
 */
export function registerLatestUserTurn(input: {
  chatId: string;
  userMessageId: number | string;
  turnKey: string;
  nowMs?: number;
}): void {
  const now = input.nowMs ?? Date.now();
  const chatId = input.chatId;

  latestChatTurnMap.set(chatId, {
    latestUserMessageId: input.userMessageId,
    latestTurnKey: input.turnKey,
    updatedAtMs: now,
  });
}

/**
 * Get the latest turn state for a chat (for testing/inspection).
 */
export function getLatestTurnState(chatId: string): ChatTurnState | undefined {
  return latestChatTurnMap.get(chatId);
}

/**
 * Reset turn state for a chat (for testing/cleanup).
 */
export function resetTurnState(chatId: string): void {
  latestChatTurnMap.delete(chatId);
}

/**
 * Reset ALL turn states (for testing only).
 */
export function resetAllTurnStates(): void {
  latestChatTurnMap.clear();
}

// ============================================================================
// Core interruption logic
// ============================================================================

/**
 * Create an interruption context for a voice response being prepared.
 */
export function createVoiceInterruptionContext(input: {
  chatId: string;
  sourceUserMessageId: number | string;
  sourceTurnKey: string;
  nowMs?: number;
}): VoiceInterruptionContext {
  return {
    chatId: input.chatId,
    sourceUserMessageId: input.sourceUserMessageId,
    sourceTurnKey: input.sourceTurnKey,
    createdAtMs: input.nowMs ?? Date.now(),
  };
}

/**
 * Evaluate whether a prepared voice response is still safe to send.
 * Must be called RIGHT BEFORE ctx.replyWithVoice().
 */
export function evaluateVoiceInterruption(
  ctx: VoiceInterruptionContext,
): VoiceInterruptionDecision {
  const chatState = latestChatTurnMap.get(ctx.chatId);

  // No turn registered for this chat → no way to check → default to safe
  if (!chatState || !chatState.latestTurnKey) {
    return {
      status: "safe_to_send",
      shouldCancelVoiceSend: false,
      shouldAllowVoiceSend: true,
      wasSuperseded: false,
      supersededByMessageId: null,
      supersededByTurnKey: null,
      hints: [
        "latest_turn_still_current",
        "voice_send_bound_to_origin_turn",
        "no_turn_registry_for_chat",
      ],
      warnings: [],
    };
  }

  // RULE A — latest user turn wins: check if this voice is superseded
  if (chatState.latestTurnKey !== ctx.sourceTurnKey) {
    return {
      status: "superseded",
      shouldCancelVoiceSend: true,
      shouldAllowVoiceSend: false,
      wasSuperseded: true,
      supersededByMessageId: chatState.latestUserMessageId,
      supersededByTurnKey: chatState.latestTurnKey,
      hints: [
        "newer_user_turn_detected",
        "safe_to_drop_stale_voice",
      ],
      warnings: [
        "voice_response_superseded",
        "stale_audio_prevented",
        "unsafe_to_send_after_new_input",
      ],
    };
  }

  // RULE B — same originating turn is still valid
  return {
    status: "safe_to_send",
    shouldCancelVoiceSend: false,
    shouldAllowVoiceSend: true,
    wasSuperseded: false,
    supersededByMessageId: null,
    supersededByTurnKey: null,
    hints: [
      "latest_turn_still_current",
      "pre_send_stale_gate_passed",
      "voice_send_bound_to_origin_turn",
    ],
    warnings: [],
  };
}

/**
 * Quick convenience check: is voice send still safe?
 */
export function isVoiceSendStillSafe(ctx: VoiceInterruptionContext): boolean {
  const decision = evaluateVoiceInterruption(ctx);
  return decision.shouldAllowVoiceSend;
}
