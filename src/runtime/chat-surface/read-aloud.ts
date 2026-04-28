import { getRuntimeRole, hasCapability } from "../../core/auth/runtime-access.js";
import { DEFAULT_VOICE_CONFIG, type VoiceConfig } from "./chat-surface.types.js";

export interface ReadAloudResult {
  success: boolean;
  voiceFileId?: string;
  error?: string;
  traceId?: string;
}

export async function canUseReadAloud(userId: string | number | null): Promise<boolean> {
  const role = getRuntimeRole(userId);
  return hasCapability(userId, "read_aloud") || role.startsWith("owner_") || role === "partner_creator";
}

export async function processReadAloud(
  userId: string | number,
  text: string,
  bot: any,
  config: VoiceConfig = DEFAULT_VOICE_CONFIG
): Promise<ReadAloudResult> {
  if (!await canUseReadAloud(userId)) {
    return { success: false, error: "read_aloud_forbidden" };
  }

  if (!text || text.trim().length < 10) {
    return { success: false, error: "text_too_short" };
  }

  try {
    console.log(`[read-aloud] generating voice for user=${userId}, text_len=${text.length}`);

    return {
      success: true,
      voiceFileId: "mock_voice_file_id",
      traceId: `tts_${Date.now()}`,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function generateVoiceReply(
  userId: string | number,
  text: string,
  bot: any,
  chatId: string | number
): Promise<{ voiceSent: boolean; textSent: boolean }> {
  const voiceResult = await processReadAloud(userId, text, bot);
  
  if (voiceResult.success) {
    try {
      await bot.telegram.sendVoice(chatId, voiceResult.voiceFileId);
      return { voiceSent: true, textSent: false };
    } catch (e) {
      console.error("[read-aloud] send failed:", e);
    }
  }
  
  return { voiceSent: false, textSent: true };
}