import fs from "fs/promises";
import path from "path";
import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel } from "./bot.js";

const DATA_DIR = path.join(process.cwd(), "data", "telegram");
const IMAGES_FILE = path.join(DATA_DIR, "images.jsonl");
const MAX_IMAGES = 3;
const MAX_PER_USER_DAY = 30;
const RATE_LIMIT_FILE = path.join(DATA_DIR, "image-rate-limits.jsonl");

export interface ImageRecord {
  image_id: string;
  user_id: string;
  chat_id: string;
  prompt: string;
  provider: string;
  url: string;
  width?: number;
  height?: number;
  created_at: number;
}

export interface ImageRateLimit {
  user_id: string;
  count: number;
  reset_at: number;
}

const imageProviders = [
  { id: "openai_web", name: "DALL-E", supportsBase64: true },
  { id: "gemini_web", name: "Gemini Image", supportsBase64: true },
  { id: "qwen_web", name: "Qwen Image", supportsBase64: false },
];

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function checkImageRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    await ensureDir();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resetAt = today.getTime() + 24 * 60 * 60 * 1000;

    const lines = (await fs.readFile(RATE_LIMIT_FILE, "utf-8").catch(() => "")).trim().split("\n").filter(Boolean);
    let used = 0;

    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        if (rec.user_id === userId && rec.reset_at > Date.now()) {
          used = rec.count || 0;
        }
      } catch {}
    }

    const remaining = MAX_PER_USER_DAY - used;
    return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
  } catch {
    return { allowed: true, remaining: MAX_PER_USER_DAY };
  }
}

export async function incrementImageRateLimit(userId: string): Promise<void> {
  try {
    await ensureDir();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resetAt = today.getTime() + 24 * 60 * 60 * 1000;

    const lines = (await fs.readFile(RATE_LIMIT_FILE, "utf-8").catch(() => "")).trim().split("\n").filter(Boolean);
    const records: ImageRateLimit[] = [];

    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        if (rec.user_id !== userId) {
          records.push(rec);
        }
      } catch {}
    }

    const existing = records.find((r) => r.reset_at > Date.now());
    if (existing) {
      existing.count = (existing.count || 0) + 1;
    } else {
      records.push({ user_id: userId, count: 1, reset_at: resetAt });
    }

    const filtered = records.filter((r) => r.reset_at > Date.now());
    const content = filtered.map((r) => JSON.stringify(r)).join("\n") + "\n";
    await fs.writeFile(RATE_LIMIT_FILE, content, "utf-8");
  } catch (e) {
    console.error("[image-layer] rate limit increment failed", e);
  }
}

export async function saveImageRecord(record: ImageRecord): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(record) + "\n";
    await fs.appendFile(IMAGES_FILE, line, "utf-8");
  } catch (e) {
    console.error("[image-layer] save record failed", e);
  }
}

export async function getUserImages(userId: string, limit = 20): Promise<ImageRecord[]> {
  const images: ImageRecord[] = [];

  try {
    await ensureDir();
    const content = await fs.readFile(IMAGES_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);

    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        if (rec.user_id === userId) {
          images.push(rec);
        }
      } catch {}
    }
  } catch {}

  return images.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}

export function buildImagePrompt(baseText: string, lang: Language): string {
  const prefix = lang === "ru"
    ? "Создай изображение на основе этого описания:"
    : "Create an image based on this description:";
  return `${prefix} ${baseText}`;
}

export async function generateImage(
  ctx: any,
  userId: string,
  chatId: string,
  prompt: string,
  baseText?: string,
  isAction = false
): Promise<{ success: boolean; urls?: string[]; error?: string }> {
  const label = getAccountLabel(userId);
  const username = String((ctx as any)?.from?.username || "");
  const lang = detectLanguage(username);

  console.log("[image-layer] generation started", {
    user_id: userId,
    chat_id: chatId,
    label,
    prompt: prompt.slice(0, 100),
    is_action: isAction,
  });

  const rateLimit = await checkImageRateLimit(userId);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: lang === "ru"
        ? "Достигнут дневной лимит генерации изображений"
        : "Daily image generation limit reached",
    };
  }

  const finalPrompt = baseText ? buildImagePrompt(baseText, lang) : prompt;

  for (const provider of imageProviders) {
    try {
      console.log("[image-layer] trying provider", provider.id);

      const response = await fetch("http://127.0.0.1:8787/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          message: finalPrompt,
          model: provider.id,
          task: { type: "image" },
          meta: {
            source: "telegram-image",
            telegram_user_id: userId,
            provider: provider.id,
            chat_id: chatId,
            label,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      const replyText = String(data?.reply || data?.output || "").trim();

      if (!replyText) continue;

      const urls: string[] = [];

      const urlRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp|gif))/gi;
      const urlMatch = replyText.match(urlRegex);
      if (urlMatch) {
        urls.push(...urlMatch.slice(0, MAX_IMAGES));
      }

      const base64Match = replyText.match(/data:image\/(\w+);base64,([A-Za-z0-9+/=]+)/);
      if (base64Match) {
        const ext = base64Match[1] === "png" ? "png" : "jpg";
        const buffer = Buffer.from(base64Match[2], "base64");
        const tempPath = path.join(DATA_DIR, `temp_${makeId("img")}.${ext}`);
        await fs.writeFile(tempPath, buffer);
        urls.push(tempPath);
      }

      if (urls.length > 0) {
        console.log("[image-layer] generation completed", {
          user_id: userId,
          provider: provider.id,
          urls_count: urls.length,
        });

        await incrementImageRateLimit(userId);

        for (const url of urls) {
          await saveImageRecord({
            image_id: makeId("img"),
            user_id: userId,
            chat_id: chatId,
            prompt: finalPrompt,
            provider: provider.id,
            url,
            created_at: Date.now(),
          });
        }

        return { success: true, urls };
      }
    } catch (providerError) {
      console.error("[image-layer] provider failed", provider.id, providerError);
    }
  }

  const errorMsg = lang === "ru"
    ? "Не удалось сгенерировать изображение"
    : "Failed to generate image";

  console.log("[image-layer] generation failed", {
    user_id: userId,
    error: errorMsg,
  });

  return { success: false, error: errorMsg };
}

export async function sendImageToTelegram(
  ctx: any,
  urls: string[],
  lang: Language = "ru"
): Promise<boolean> {
  try {
    if (urls.length === 1) {
      const url = urls[0];
      if (url.startsWith("http")) {
        await ctx.replyWithPhoto(url);
      } else {
        await ctx.replyWithPhoto({ source: url });
      }
      return true;
    }

    const media: any[] = [];
    for (let i = 0; i < Math.min(urls.length, 10); i++) {
      const url = urls[i];
      media.push({
        type: "photo" as const,
        media: url.startsWith("http") ? url : { source: url },
      });
    }

    if (media.length > 0) {
      await ctx.replyWithMediaGroup(media);
      return true;
    }

    return false;
  } catch (e) {
    console.error("[image-layer] send to telegram failed", e);
    return false;
  }
}

export function formatUserImages(images: ImageRecord[], lang: Language = "ru"): string {
  if (images.length === 0) {
    return lang === "ru" ? "Нет сгенерированных изображений" : "No generated images";
  }

  const lines = [
    lang === "ru" ? "🖼 Ваши изображения:" : "🖼 Your images:",
  ];

  for (const img of images.slice(0, 10)) {
    const date = new Date(img.created_at).toLocaleString();
    const preview = img.prompt.slice(0, 50);
    lines.push(`• ${date} | ${img.provider} | ${preview}...`);
  }

  return lines.join("\n");
}

export function getImageCommands(lang: Language = "ru"): { usage: string; description: string }[] {
  return [
    {
      usage: "/image <prompt>",
      description: lang === "ru"
        ? "Сгенерировать изображение по описанию"
        : "Generate image from description",
    },
    {
      usage: "/images",
      description: lang === "ru"
        ? "Показать историю изображений"
        : "Show image history",
    },
  ];
}