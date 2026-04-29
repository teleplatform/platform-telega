import { getAccountLabel } from "./bot.js";
import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { Markup } from "telegraf";

const DATA_DIR = process.cwd() + "/data/telegram";

export interface VoiceSettings {
  voice_enabled: boolean;
  voice_provider: string;
  voice_model: string;
  voice_language: string;
  tts_speed: number;
}

export interface VoiceContext {
  user_id: string;
  chat_id: string;
  voice_settings: VoiceSettings;
  last_voice_input?: string;
  last_voice_output?: string;
  voice_mode_enabled: boolean;
  timestamp: number;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voice_enabled: false,
  voice_provider: "telegram",
  voice_model: "default",
  voice_language: "auto",
  tts_speed: 1.0,
};

const voiceContexts = new Map<string, VoiceContext>();

function getVoiceContextKey(chatId: string, userId: string): string {
  return `${chatId}:${String(userId)}`;
}

export function getOrCreateVoiceContext(chatId: string, userId: string): VoiceContext {
  const key = getVoiceContextKey(chatId, userId);
  let ctx = voiceContexts.get(key);
  if (!ctx) {
    ctx = {
      user_id: userId,
      chat_id: chatId,
      voice_settings: { ...DEFAULT_VOICE_SETTINGS },
      voice_mode_enabled: false,
      timestamp: Date.now(),
    };
    voiceContexts.set(key, ctx);
  }
  return ctx;
}

export function isVoiceModeEnabled(chatId: string, userId: string): boolean {
  const ctx = getOrCreateVoiceContext(chatId, userId);
  return ctx.voice_mode_enabled;
}

export async function toggleVoiceMode(chatId: string, userId: string, enable?: boolean): Promise<boolean> {
  const ctx = getOrCreateVoiceContext(chatId, userId);
  const newState = enable !== undefined ? enable : !ctx.voice_mode_enabled;
  ctx.voice_mode_enabled = newState;
  ctx.timestamp = Date.now();
  return newState;
}

export function getVoiceSettings(chatId: string, userId: string): VoiceSettings {
  const ctx = getOrCreateVoiceContext(chatId, userId);
  return ctx.voice_settings;
}

export async function updateVoiceSettings(
  chatId: string,
  userId: string,
  settings: Partial<VoiceSettings>
): Promise<VoiceSettings> {
  const ctx = getOrCreateVoiceContext(chatId, userId);
  ctx.voice_settings = { ...ctx.voice_settings, ...settings };
  ctx.timestamp = Date.now();
  return ctx.voice_settings;
}

export async function handleVoiceInput(
  ctx: any,
  chatId: string,
  userId: string
): Promise<{ text: string; transcript?: string } | null> {
  try {
    const voice = (ctx as any)?.message?.voice;
    if (!voice) return null;

    const fileId = voice.file_id;
    const duration = voice.duration;
    const label = getAccountLabel(userId);

    console.log("[voice-layer] voice input received", {
      chat_id: chatId,
      user_id: userId,
      label,
      file_id: fileId,
      duration,
    });

    const voiceCtx = getOrCreateVoiceContext(chatId, userId);

    try {
      const file = await ctx.telegram.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      const transcriptionPrompt = `Transcribe this voice message ${fileUrl}`;

      const response = await fetch("http://127.0.0.1:8787/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          message: transcriptionPrompt,
          model: "gpt-4o",
          task: { type: "chat" },
          meta: {
            source: "telegram-voice",
            telegram_user_id: userId,
            voice_duration: duration,
            chat_id: chatId,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      const transcript = String(data?.output || data?.reply || "").trim();

      if (transcript) {
        voiceCtx.last_voice_input = transcript;
        console.log("[voice-layer] voice transcribed", {
          chat_id: chatId,
          user_id: userId,
          transcript: transcript.slice(0, 100),
        });
        return { text: transcript, transcript };
      }
    } catch (transcribeErr) {
      console.error("[voice-layer] transcription failed", transcribeErr);
    }

    return { text: "[Voice message - transcription unavailable]", transcript: undefined };
  } catch (e) {
    console.error("[voice-layer] voice input failed", e);
    return null;
  }
}

export async function handleTTSOutput(
  ctx: any,
  chatId: string,
  userId: string,
  text: string
): Promise<boolean> {
  try {
    const settings = getVoiceSettings(chatId, userId);
    const username = String((ctx as any)?.from?.username || "");
    const lang = detectLanguage(username) || "ru";
    const label = getAccountLabel(userId);

    console.log("[voice-layer] tts output", {
      chat_id: chatId,
      user_id: userId,
      label,
      text_length: text.length,
      provider: settings.voice_provider,
    });

    const ttsSystemPrompt = lang === "ru"
      ? `Прочитай следующий текст голосом. Верни только аудио в формате OGG (opus). Не добавляй пояснений.`
      : `Read the following text aloud. Return only audio in OGG (opus) format. No explanations.`;

    try {
      const response = await fetch("http://127.0.0.1:8787/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          message: `${ttsSystemPrompt}\n\n${text}`,
          model: "gpt-4o",
          task: { type: "chat" },
          meta: {
            source: "telegram-tts",
            telegram_user_id: userId,
            voice_language: lang,
            tts_speed: settings.tts_speed,
            chat_id: chatId,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      const replyText = String(data?.reply || data?.output || "").trim();

      if (replyText && (replyText.includes("OGG") || replyText.includes("voice") || replyText.includes("audio"))) {
        await ctx.answerCbQuery(lang === "ru" ? "TTS скоро!" : "TTS coming soon!");
      } else if (replyText) {
        const voiceCtx = getOrCreateVoiceContext(chatId, userId);
        voiceCtx.last_voice_output = replyText.slice(0, 100);
      }
    } catch (ttsErr) {
      console.error("[voice-layer] tts call failed", ttsErr);
    }

    await ctx.reply(lang === "ru"
      ? "🔊 Voice Layer активирован! Теперь вы можете отправлять голосовые сообщения."
      : "🔊 Voice Layer activated! You can now send voice messages.");

    const voiceCtx = getOrCreateVoiceContext(chatId, userId);
    voiceCtx.last_voice_output = text;
    return true;
  } catch (e) {
    console.error("[voice-layer] tts output failed", e);
    return false;
  }
}

export function buildVoiceKeyboard(lang: Language = "ru"): { text: string; callback_data: string }[][] {
  return [
    [
      { text: lang === "ru" ? "🔊 Вкл/Выкл голос" : "🔊 Toggle voice", callback_data: "voice:toggle" },
    ],
    [
      { text: lang === "ru" ? "🔊 Озвучить последний" : "🔊 Speak last", callback_data: "voice:speak" },
    ],
    [
      { text: "⬅️ Назад / Back", callback_data: "menu:main" },
    ],
  ];
}

export function formatVoiceStatus(chatId: string, userId: string, lang: Language = "ru"): string {
  const ctx = getOrCreateVoiceContext(chatId, userId);
  const settings = ctx.voice_settings;
  const enabled = ctx.voice_mode_enabled;

  const status = enabled
    ? (lang === "ru" ? "🔊 Голосовой режим ВКЛ" : "🔊 Voice mode ON")
    : (lang === "ru" ? "🔕 Голосовой режим ВЫКЛ" : "🔕 Voice mode OFF");

  return `${status}
${lang === "ru" ? "Провайдер" : "Provider"}: ${settings.voice_provider}
${lang === "ru" ? "Скорость TTS" : "TTS Speed"}: ${settings.tts_speed}x`;
}