import { getRuntimeRole } from "../../core/auth/runtime-access.js";
import { hasCapability } from "../../core/auth/runtime-access.js";

export interface VoiceInputResult {
  success: boolean;
  text?: string;
  error?: string;
  traceId?: string;
}

const VOICE_SCRIPT = `
import { Telegraf, Markup } from "telegraf";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

export async function downloadVoiceMessage(
  bot: Telegraf,
  fileId: string,
  chatId: string
): Promise<{ filePath: string; duration: number } | null> {
  try {
    const file = await bot.telegram.getFile(fileId);
    const filePath = join("/tmp", \`voice_\${fileId}.ogg\`);
    
    // Download file
    const fileUrl = await bot.telegram.getFileLink(fileId);
    const response = await fetch(fileUrl.toString());
    const buffer = await response.arrayBuffer();
    writeFileSync(filePath, Buffer.from(buffer));
    
    return { filePath, duration: 0 };
  } catch (e) {
    console.error("[voice-input] download failed:", e);
    return null;
  }
}

export async function transcribeAudio(
  filePath: string
): Promise<{ text: string; error?: string }> {
  const { OpenAI } = await import("openai");
  const openai = new OpenAI();
  
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(filePath),
      model: "whisper-1",
    });
    
    return { text: transcription.text };
  } catch (e: any) {
    return { text: "", error: e.message };
  }
}

function createReadStream(filePath: string) {
  return { path: filePath } as any;
}
`;

export async function canUseVoiceInput(userId: string | number | null): Promise<boolean> {
  const role = getRuntimeRole(userId);
  return hasCapability(userId, "voice_input") || role.startsWith("owner_");
}

export async function processVoiceInput(
  userId: string | number,
  fileId: string,
  bot: any
): Promise<VoiceInputResult> {
  if (!await canUseVoiceInput(userId)) {
    return { success: false, error: "voice_input_forbidden" };
  }

  try {
    console.log(`[voice-input] processing voice from user=${userId}, file=${fileId}`);
    
    return {
      success: true,
      text: "[voice-input mock - implement real transcription]",
      traceId: `voice_${Date.now()}`,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}