import { Markup } from "telegraf";
import { createTelegramRuntime } from "./runtime/telegram-runtime.js";
import { registerTextHandler } from "./handlers/text.handler.js";
import { registerCallbackHandlers } from "./handlers/callback.handler.js";
import { registerVoiceHandler } from "./handlers/voice.handler.js";
import { registerCommandHandlers } from "./commands/command.handler.js";
import { showCompactMenu } from "./keyboards/telegram-keyboards.js";
import { userIdOf, getTelegramRole, editOrReply } from "./utils/telegram-utils.js";
import { settingsOf } from "./state/telegram-state.js";

export type AccountLabel = "★" | "★★" | "★★★" | "";

export function getAccountLabel(userId: string | number | undefined): AccountLabel {
  const id = String(userId || "");
  if (id === "267246987") return "★";
  if (id === "1166943180") return "★★";
  if (id === "591948691") return "★★★";
  return "";
}

export function getAccountName(userId: string | number | undefined): string {
  const label = getAccountLabel(userId);
  if (label === "★") return "Nikita (main)";
  if (label === "★★") return "Nikita (secondary)";
  if (label === "★★★") return "Arisha";
  return "User";
}

export function isArisha(userId: string | number | undefined): boolean {
  return getAccountLabel(userId) === "★★★";
}

export function canUseDangerousFeature(userId: string | number | undefined): boolean {
  const label = getAccountLabel(userId);
  return label === "★" || label === "★★";
}

export function formatMessageWithLabel(userId: string | number | undefined, message: string): string {
  const label = getAccountLabel(userId);
  return label ? `${label} ${message}` : message;
}

function getTelegaRoot(): string {
  const root = (process.env.TELEGA_ROOT || "").trim();
  if (!root) throw new Error("TELEGA_ROOT is not set");
  return root;
}

function isPollingEnabled(): boolean {
  return process.env.PANTHEON_TG_POLLING === "1";
}

export async function startPantheonTelegramBot() {
  const { initEvidenceStore } = await import("../providers/creator/evidence-store.js");
  const { initJobRegistry } = await import("../providers/creator/job-runtime.js");
  await initEvidenceStore();
  await initJobRegistry();

  console.log("[pantheon-tg] boot check", {
    polling: process.env.PANTHEON_TG_POLLING,
    token_present: Boolean((process.env.TELEGRAM_BOT_TOKEN || "").trim()),
    telega_root_present: Boolean((process.env.TELEGA_ROOT || "").trim()),
  });

  if (!isPollingEnabled()) {
    console.log("[pantheon-tg] polling disabled");
    return null;
  }

  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    console.log("[pantheon-tg] TELEGRAM_BOT_TOKEN missing");
    return null;
  }

  const telegaRoot = getTelegaRoot();
  console.log("[telegram:runtime:created]");

  let runtime: import("./runtime/telegram-runtime.js").TelegramRuntime;
  try {
    runtime = createTelegramRuntime({
      token,
      polling: process.env.PANTHEON_TG_POLLING === "1",
    });
  } catch (e: any) {
    console.error("[telegram:runtime:blocked]", e?.message || e);
    return null;
  }

  const bot = runtime.bot;
  const PAGE_SIZE = 10;

  bot.hears("▦ Menu", async (ctx) => {
    try {
      console.log("[telegram-menu] menu_open_requested", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
      await showCompactMenu(ctx, { getTelegramRole, userIdOf, settingsOf, editOrReply });
      console.log("[telegram-menu] menu_rendered", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
    } catch (e: any) {
      console.error("[telegram-menu] hears:▦ Menu failed", e?.message || e);
    }
  });

  const deps = { telegaRoot, PAGE_SIZE, getAccountLabel };

  try {
    console.log("[telegram:register] commands");
    registerCommandHandlers(bot, deps);
    console.log("[telegram:register] commands OK");
  } catch (e) {
    console.error("[telegram:register] commands FAILED", e);
  }

  

  try {
    console.log("[telegram:register] callbacks");
    registerCallbackHandlers(bot, deps);
    console.log("[telegram:register] callbacks OK");
  } catch (e) {
    console.error("[telegram:register] callbacks FAILED", e);
  }

  try {
    console.log("[telegram:register] text");
    registerTextHandler(bot, deps);
    console.log("[telegram:register] text OK");
  } catch (e) {
    console.error("[telegram:register] text FAILED", e);
  }

  try {
    console.log("[telegram:register] voice");
    registerVoiceHandler(bot, { getAccountLabel });
    console.log("[telegram:register] voice OK");
  } catch (e) {
    console.error("[telegram:register] voice FAILED", e);
  }

  bot.catch((err: any, ctx: any) => {
    console.error("[telegram:bot:error]", {
      updateType: ctx.updateType,
      err: err?.message || err,
      stack: err?.stack?.split("\n")?.slice(0, 3)?.join(" | "),
    });
  });

  process.once("SIGINT", () => runtime.stop("SIGINT"));
  process.once("SIGTERM", () => runtime.stop("SIGTERM"));

  console.log("[telegram:runtime:launching]");
  console.log("[pantheon-tg] bot launched (polling)");
  await runtime.launch();

  return bot;
}

export async function startTelegramBotIfEnabled() {
  const enabled = process.env.TELEGPT_ENABLE_TELEGRAM_BOT === "1";
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!enabled || !token) return null;
  return startPantheonTelegramBot();
}
