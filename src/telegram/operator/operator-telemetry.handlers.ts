// Handler layer — glue between Telegraf and telemetry surface
// Context types are provided by Telegraf runtime (no explicit import needed)

import { Markup } from "telegraf";
import { renderScreen, buildMainKeyboard, buildActionsKeyboard } from "./operator-telemetry.view.js";
import type { TelemetryScreen } from "./operator-telemetry.types.js";
import {
  actionRefresh,
  actionOperatorReset,
  actionSoftRecover,
  actionRestartWatchdog,
  actionRestartBot,
} from "./operator-telemetry.actions.js";

// Nav state per chat — stored in memory (warm only; survives bot restart via state reset)
const chatNavState: Map<number, { screen: TelemetryScreen; messageId?: number }> = new Map();

const AUTO_REFRESH_MS = 15000; // 15 sec

function getNavState(chatId: number): TelemetryScreen {
  return chatNavState.get(chatId)?.screen || "HOME";
}

function setNavState(chatId: number, screen: TelemetryScreen, messageId?: number): void {
  chatNavState.set(chatId, { screen, messageId });
}

function getLastMessageId(chatId: number): number | undefined {
  return chatNavState.get(chatId)?.messageId;
}

// ============================================
// COMMAND: /ops
// ============================================

export async function handleOpsCommand(ctx: any): Promise<void> {
  const chatId = ctx.chat!.id;
  const messageId = ctx.message?.message_id;
  setNavState(chatId, "HOME", messageId);

  const text = renderScreen("HOME");

  const sent = await ctx.reply(text, {
    reply_markup: buildMainKeyboard("HOME"),
  });

  // Store message ID for auto-refresh
  if (sent?.message_id) {
    setNavState(chatId, "HOME", sent.message_id);
  }
}

// ============================================
// CALLBACK: inline button navigation
// ============================================

export async function handleCallbackQuery(ctx: any): Promise<void> {
  const payload = ctx.callbackQuery!.data;
  const chatId = ctx.chat!.id;

  // Parse payload
  let screen: TelemetryScreen;
  let action: string | null = null;

  if (payload.startsWith("nav:")) {
    screen = (payload.replace("nav:", "") as TelemetryScreen) || "HOME";
  } else if (payload.startsWith("act:")) {
    action = payload.replace("act:", "");
    screen = getNavState(chatId); // stay on current screen after action
  } else {
    // legacy: direct screen name
    screen = (payload as TelemetryScreen) || "HOME";
  }

  // Handle action first
  if (action) {
    const result = await executeOperatorAction(action);
    // Show result as temporary alert (via answerCbQuery)
    await ctx.answerCbQuery(result, { show_alert: true });
    // Screen will be re-rendered below
  }

  // Update nav state for screen changes (preserve or get from callback)
  if (payload.startsWith("nav:")) {
    const existingMsgId = getLastMessageId(chatId) || ctx.callbackQuery?.message?.message_id;
    setNavState(chatId, screen, existingMsgId);
  }

  // Render current screen with appropriate keyboard
  const text = renderScreen(screen);
  let markup;

  if (action === "show_actions") {
    markup = buildActionsKeyboard();
  } else {
    markup = buildMainKeyboard(screen);
  }

  // Edit message in place (no new spam)
  try {
    await ctx.editMessageText(text, {
      reply_markup: markup,
      disable_web_page_preview: true,
    });
  } catch {
    // If edit fails (e.g. message too old), fallback to reply
    await ctx.reply(text, {
      reply_markup: markup,
      disable_web_page_preview: true,
    });
  }
}

// ============================================
// OPERATOR ACTION ROUTER
// ============================================

async function executeOperatorAction(action: string): Promise<string> {
  try {
    switch (action) {
      case "refresh":
        return await actionRefresh();
      case "operator_reset":
        return await actionOperatorReset();
      case "soft_recover":
        return await actionSoftRecover();
      case "restart_watchdog":
        return await actionRestartWatchdog();
      case "restart_bot":
        return await actionRestartBot();
      default:
        return `❓ Unknown action: ${action}`;
    }
  } catch (err: any) {
    return `❌ Action failed: ${err.message}`;
  }
}

// ============================================
// TEXT HANDLERS (for regular message commands from keyboard)
// ============================================

export function matchTextCommand(text: string): boolean {
  const commands = [
    "🛡 Ops",
    "/ops",
    "Ops",
    "ops",
    "/operator",
    "operator",
  ];
  return commands.includes(text.trim());
}

export async function handleTextCommand(ctx: any): Promise<void> {
  // Same as /ops
  await handleOpsCommand(ctx);
}

// ============================================
// CALLBACK DECODER
// ============================================

export function decodeCallbackData(data: string): { screen?: TelemetryScreen; action?: string } {
  if (data.startsWith("nav:")) {
    return { screen: data.replace("nav:", "") as TelemetryScreen };
  }
  if (data.startsWith("act:")) {
    return { action: data.replace("act:", "") };
  }
  return {};
}
