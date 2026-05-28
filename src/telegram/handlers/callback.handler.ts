// @ts-nocheck — runtime-preserving extraction; types match original closure behavior
import { Markup } from "telegraf";
import type { Telegraf } from "telegraf";
import { isMaker } from "../../intel/makerGate.js";
import { MSG } from "#i18n/messages";
import { detectLanguage } from "../../providers/creator/i18n.js";
import { buildReplyExtra, saveResponse as saveActionResponse, getLastResponse, logAction } from "../action-buttons.js";
import { handleTTSOutput, toggleVoiceMode, getVoiceSettings, isVoiceModeEnabled, formatVoiceStatus, buildVoiceKeyboard } from "../voice-layer.js";
import { generateImage, sendImageToTelegram, getUserImages, formatUserImages, getImageCommands } from "../image-layer.js";
import { traceExists } from "../../intel/traceWriter.js";
import { explainTrace, formatTraceExplainWithDiff, walkRetryChain, buildReasonHintForSingleTrace } from "../../intel/explainTrace.js";
import { findTaskIdByTrace } from "../../intel/buildResultIndex.js";
import { retryBuildTask } from "../../intel/retryBuildTask.js";
import { getForgeTask, updateForgeTask, handleForgeTask, formatForgeTask } from "../forge-shell.js";
import { getWorkflow, checkGates, restartWorkflow } from "../forge-workflow.js";
import { formatDiagnosis, createHealPlan, formatHealPlan } from "../forge-heal.js";
import { getWorkflowTimeline } from "../forge-timeline.js";
import { formatWorkflowCard } from "../forge-ui.js";
import { showCompactMenu, menuButtonKeyboard, compactMenuKeyboard, providerLabel, providerKeyboard, bridgeKeyboard } from "../keyboards/telegram-keyboards.js";
import { userIdOf, getTelegramRole, editOrReply } from "../utils/telegram-utils.js";
import { settingsOf } from "../state/telegram-state.js";
import fs from "fs";
import path from "path";

export type TelegramProvider =
  | "auto"
  | "openai_web"
  | "qwen_web"
  | "deepseek_web"
  | "kimi_web"
  | "ollama_local";

export type AccountLabel = "★" | "★★" | "★★★" | "";

export interface CallbackHandlerContext {
  telegaRoot: string;
  PAGE_SIZE: number;
  getAccountLabel(uid: string | number | undefined): AccountLabel;
}

export function registerCallbackHandlers(bot: Telegraf, deps: CallbackHandlerContext): void {
  console.log("[tg:diag] registerCallbackHandlers called");

  // Global callback_query middleware: log every callback, catch uncaught errors
  bot.use(async (ctx, next) => {
    if (ctx.callbackQuery) {
      console.log("[telegram:callback:received]", {
        action: ctx.callbackQuery?.data,
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
      });
      try {
        await next();
      } catch (e: any) {
        console.error("[telegram:callback:error]", {
          action: ctx.callbackQuery?.data,
          user_id: ctx.from?.id,
          chat_id: ctx.chat?.id,
          error: e?.message || e,
          stack: e?.stack?.split("\n")?.slice(0, 3)?.join(" | "),
        });
        try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
        try { await ctx.reply("⚠️ Callback error. Check logs."); } catch {}
      }
    } else {
      await next();
    }
  });

  console.log("[telegram:register] callback:split:v2:main");
  bot.action("split:v2:main", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "split:v2:main" });
      await ctx.answerCbQuery("Menu").catch(() => {});
      await showCompactMenu(ctx, { getTelegramRole, userIdOf, settingsOf, editOrReply });
      console.log("[telegram-menu] menu_rendered", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "split:v2:main",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ split:v2:main error. Check logs."); } catch {}
    }
  });

  bot.action("split:v2:collapse", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "split:v2:collapse" });
      await ctx.answerCbQuery("Closed").catch(() => {});
      await editOrReply(ctx, "Menu collapsed. Tap ▦ Menu to open.", menuButtonKeyboard());
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "split:v2:collapse",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ split:v2:collapse error. Check logs."); } catch {}
    }
  });

  bot.action("split:v2:chat", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "split:v2:chat" });
      await ctx.answerCbQuery("Chat").catch(() => {});
      await editOrReply(ctx, "Chat mode. Send a message.", menuButtonKeyboard());
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "split:v2:chat",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ split:v2:chat error. Check logs."); } catch {}
    }
  });

  bot.action("split:v2:help", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "split:v2:help" });
      await ctx.answerCbQuery("Help").catch(() => {});
      await editOrReply(ctx, "Help: use /start, open ▦ Menu, choose Providers, then send a message.", menuButtonKeyboard());
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "split:v2:help",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ split:v2:help error. Check logs."); } catch {}
    }
  });

  bot.action("split:v2:settings", async (ctx) => {
    try {
      await ctx.answerCbQuery("Settings").catch(() => {});
       return ctx.reply("⚙️ Settings");
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "split:v2:settings",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ split:v2:settings error. Check logs."); } catch {}
    }
  });

  bot.action("split:v2:providers", async (ctx) => {
     try {
       console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "split:v2:providers" });
       await ctx.answerCbQuery("Providers").catch(() => {});
       return ctx.reply(
         "🧠 Providers",
         providerKeyboard(settingsOf(ctx), getTelegramRole(userIdOf(ctx)))
       );
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "split:v2:providers",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ split:v2:providers error. Check logs."); } catch {}
    }
  });

  bot.action("provider:view", async (ctx) => {
    try {
      await ctx.answerCbQuery("Provider info in settings");
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "provider:view",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ provider:view error. Check logs."); } catch {}
    }
  });

  bot.action(/^provider:set:(auto|openai_web|qwen_web|deepseek_web|kimi_web|ollama_local)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      const role = getTelegramRole(uid);

      if (!isMaker(uid, priv)) {
        await ctx.answerCbQuery(MSG.makerOnly);
        return;
      }

      const provider = String((ctx as any)?.match?.[1] || "auto") as TelegramProvider;
      const userId = userIdOf(ctx);
      const oldSettings = settingsOf(ctx);
      const newSettings = { ...oldSettings, provider, model: providerToModel(provider) };
      userRuntimeSettings.set(userId, newSettings);

      const label = deps.getAccountLabel(uid);
      console.log("[telegram-menu] provider:set", {
        user_id: uid,
        label,
        provider,
        model: newSettings.model,
        role,
        priv,
      });

      await ctx.answerCbQuery(`Provider: ${providerLabel(provider)}`);

      const keyboard = providerKeyboard(settingsOf(ctx), getTelegramRole(userIdOf(ctx)));
      await editOrReply(ctx, `🌐 Provider: *${providerLabel(provider)}*\nModel: *\`${newSettings.model}\`*`, keyboard);
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "provider:set",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ provider:set error. Check logs."); } catch {}
    }
  });

  bot.action("split:v2:bridge", async (ctx) => {
    try {
      await ctx.answerCbQuery("Bridge").catch(() => {});
      const settings = settingsOf(ctx);
       return ctx.reply(
         "🌉 Creator Bridge",
         bridgeKeyboard(settings, providerLabel(settings.provider))
       );
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "split:v2:bridge",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ split:v2:bridge error. Check logs."); } catch {}
    }
  });

  bot.action("bridge:toggle", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      const role = getTelegramRole(uid);

      if (!isMaker(uid, priv)) {
        await ctx.answerCbQuery(MSG.makerOnly);
        return;
      }

      const userId = userIdOf(ctx);
      const settings = settingsOf(ctx);
      const newBridgeEnabled = !settings.bridgeEnabled;
      userRuntimeSettings.set(userId, { ...settings, bridgeEnabled: newBridgeEnabled });

      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-menu] bridge:toggle", {
        user_id: uid,
        label,
        bridgeEnabled: newBridgeEnabled,
        role,
        priv,
      });
      await ctx.answerCbQuery(newBridgeEnabled ? "✅ Bridge On" : "⬜ Bridge Off");
      const text =
        `🔗 *Bridge settings*\n\n` +
        `Bridge: *${newBridgeEnabled ? "✅ On" : "⬜ Off"}*\n` +
        `Creator Mode: *${settings.creatorMode ? "🧠 On" : "⬜ Off"}*\n` +
        `Provider: *${providerLabel(settings.provider)}*`;
      await editOrReply(ctx, text, bridgeKeyboard(settingsOf(ctx), providerLabel(settingsOf(ctx).provider)));
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "bridge:toggle",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ bridge:toggle error. Check logs."); } catch {}
    }
  });

  bot.action("creator:toggle", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      const role = getTelegramRole(uid);

      if (!isMaker(uid, priv)) {
        await ctx.answerCbQuery(MSG.makerOnly);
        return;
      }

      const userId = userIdOf(ctx);
      const settings = settingsOf(ctx);
      const newCreatorMode = !settings.creatorMode;
      userRuntimeSettings.set(userId, { ...settings, creatorMode: newCreatorMode });

      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-menu] creator:toggle", {
        user_id: uid,
        label,
        creatorMode: newCreatorMode,
        role,
        priv,
      });

      await ctx.answerCbQuery(newCreatorMode ? "🧠 Creator On" : "⬜ Creator Off");
      const text =
        `🔗 *Bridge settings*\n\n` +
        `Bridge: *${settings.bridgeEnabled ? "✅ On" : "⬜ Off"}*\n` +
        `Creator Mode: *${newCreatorMode ? "🧠 On" : "⬜ Off"}*\n` +
        `Provider: *${providerLabel(settings.provider)}*`;
      await editOrReply(ctx, text, bridgeKeyboard(settingsOf(ctx), providerLabel(settingsOf(ctx).provider)));
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "creator:toggle",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ creator:toggle error. Check logs."); } catch {}
    }
  });

  bot.action("bridge:health", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      const role = getTelegramRole(uid);

      if (!isMaker(uid, priv)) {
        await ctx.answerCbQuery(MSG.makerOnly);
        return;
      }

      const settings = settingsOf(ctx);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const provider = settings.provider || "auto";
      const selectedProvider = provider;
      const healthEndpoint =
        selectedProvider === "openai_web"
          ? "http://127.0.0.1:8787/v1/providers/openai_web/health"
          : selectedProvider === "qwen_web"
            ? "http://127.0.0.1:8787/v1/providers/qwen_web/health"
            : selectedProvider === "deepseek_web"
              ? "http://127.0.0.1:8787/v1/providers/deepseek_web/health"
              : null;

      const label = deps.getAccountLabel(uid);
      console.log("[telegram-menu] bridge:health check", {
        user_id: uid,
        label,
        selectedProvider,
        role,
        priv,
      });

      await ctx.answerCbQuery("Checking bridge health...");

      if (!healthEndpoint) {
        await editOrReply(ctx, `ℹ️ Health check not available for *${providerLabel(selectedProvider)}*`, bridgeKeyboard(settingsOf(ctx), providerLabel(settingsOf(ctx).provider)));
        return;
      }

      const start = Date.now();
      const res = await fetch(healthEndpoint);
      const elapsed = Date.now() - start;
      const data = (await res.json().catch(() => ({}))) as any;
      const ok = res.ok && data?.status === "ok";

      const text = ok
        ? `✅ Bridge *${providerLabel(selectedProvider)}* is healthy (${elapsed}ms)`
        : `❌ Bridge *${providerLabel(selectedProvider)}* unhealthy (${elapsed}ms): ${data?.error || res.statusText || res.status}`;
      await editOrReply(ctx, text, bridgeKeyboard(settingsOf(ctx), providerLabel(settingsOf(ctx).provider)));
    } catch (e: any) {
      console.error("[telegram:callback:error]", {
        action: "bridge:health",
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        error: e?.message || e,
      });
      try { await ctx.answerCbQuery("⚠️ Error"); } catch {}
      try { await ctx.reply("⚠️ bridge:health error. Check logs."); } catch {}
    }
  });

  bot.action(/^brp:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const pageRaw = Number((ctx as any)?.match?.[1] || 1);
      const page = Math.max(1, pageRaw - 1);
      const payload = renderBuildResultsPayload(page, deps.telegaRoot, deps.PAGE_SIZE);
      await ctx.answerCbQuery(MSG.cb.results);
      await (ctx as any).reply(payload.text, payload.keyboard);
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^brr:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const page = Math.max(1, Number((ctx as any)?.match?.[1] || 1));
      const payload = renderBuildResultsPayload(page, deps.telegaRoot, deps.PAGE_SIZE);
      await ctx.answerCbQuery(MSG.cb.refresh);
      await (ctx as any).reply(payload.text, payload.keyboard);
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^brj:(\d+):(-?\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const _current = Number((ctx as any)?.match?.[1] || 1);
      const delta = Number((ctx as any)?.match?.[2] || 0);
      const page = Math.max(1, _current + delta);
      const payload = renderBuildResultsPayload(page, deps.telegaRoot, deps.PAGE_SIZE);
      await ctx.answerCbQuery(MSG.cb.results);
      await (ctx as any).reply(payload.text, payload.keyboard);
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^brl:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const _current = Number((ctx as any)?.match?.[1] || 1);
      const totalPages = Number((ctx as any)?.match?.[1] || 1);
      const page = Math.max(1, Math.ceil(totalPages / 10) * 10);
      const payload = renderBuildResultsPayload(page, deps.telegaRoot, deps.PAGE_SIZE);
      await ctx.answerCbQuery(MSG.cb.results);
      await (ctx as any).reply(payload.text, payload.keyboard);
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^brc:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      await ctx.answerCbQuery(MSG.cb.cleared);
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^brs:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const page = Math.max(1, Number((ctx as any)?.match?.[1] || 1));
      gcPending();
      const k = keyOf(ctx);
      pendingSearch.set(k, { kind: "build_results_search", page });
      const lastMsg = lastResultsListMsg.get(k);
      const msgText = `🔍 *Search results* — send text to filter by pack name (page ${page})`;
      if (lastMsg) {
        try {
          await ctx.telegram.editMessageText(ctx.chat!.id, lastMsg.message_id, undefined, msgText);
        } catch {
          await ctx.reply(msgText, { parse_mode: "Markdown" as any });
        }
      } else {
        await ctx.reply(msgText, { parse_mode: "Markdown" as any });
      }
      await ctx.answerCbQuery(MSG.cb.search);
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^br:(.+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const id = (ctx as any)?.match?.[1] || "";
      const filePath = path.join(deps.telegaRoot, "build-cache", "results", `${id}.json`);
      if (!fs.existsSync(filePath)) {
        await ctx.answerCbQuery(MSG.cb.notFound);
        return;
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const result = JSON.parse(raw);
      const status = result.status || "unknown";
      const pack = result.pack || "?";
      const createdAt = result.created_at || "?";
      const branch = result.branch || "";
      const commit = result.commit || "";
      const errorMsg = result.error?.message || "";
      const output = result.output || "";
      const text = [
        `📦 *Build Result*`,
        ``,
        `ID: \`${id}\``,
        `Pack: ${pack}`,
        `Status: *${status}*`,
        `Created: ${createdAt}`,
        branch ? `Branch: ${branch}` : "",
        commit ? `Commit: \`${commit.slice(0, 12)}\`` : "",
        errorMsg ? `\n❌ *Error:* ${errorMsg.slice(0, 200)}` : "",
        output ? `\n📄 *Output (first 1500 chars):*\n\`\`\`\n${output.slice(0, 1500)}\n\`\`\`` : "",
      ]
        .filter(Boolean)
        .join("\n");
      await ctx.answerCbQuery(MSG.cb.detail);
      await ctx.reply(text, { parse_mode: "Markdown" as any });
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^trace:([0-9a-fA-F-]{16,})$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const traceId = (ctx as any)?.match?.[1] || "";
      const exists = traceExists(deps.telegaRoot, traceId);
      if (!exists) {
        await ctx.answerCbQuery(MSG.cb.notFound);
        return;
      }
      const explain = explainTrace(deps.telegaRoot, traceId);
      const withDiff = formatTraceExplainWithDiff(deps.telegaRoot, explain, traceId);
      const chain = walkRetryChain(deps.telegaRoot, traceId);
      const statusEmoji = explain.status === "success" ? "✅" : explain.status === "failed" ? "❌" : "🟡";

      const text = [
        `${statusEmoji} *Trace: \`${traceId.slice(0, 16)}…\`*`,
        ``,
        `*Status:* ${explain.status}`,
        explain.intent ? `*Intent:* ${explain.intent}` : "",
        explain.best?.pack ? `*Pack:* ${explain.best.pack}` : "",
        explain.best?.model ? `*Model:* ${explain.best.model}` : "",
        ``,
        withDiff ? withDiff.slice(0, 500) : "",
        chain.length > 1 ? `\n🔄 *Retry chain:* ${chain.length} steps` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback("🔄 Retry", `retry:${traceId}`),
        Markup.button.callback("🔗 Chain", `retry_chain:${traceId}`),
      ]);

      await ctx.answerCbQuery(MSG.cb.trace);
      await ctx.reply(text, { ...keyboard, parse_mode: "Markdown" as any });
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^retry:([0-9a-fA-F-]{16,})$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const traceId = (ctx as any)?.match?.[1] || "";

      const chain = walkRetryChain(deps.telegaRoot, traceId);
      const isLast = chain[chain.length - 1] === traceId;
      const hasExistingResult = traceExists(deps.telegaRoot, traceId);
      const hint = buildReasonHintForSingleTrace(deps.telegaRoot, chain, traceId);
      const taskId = findTaskIdByTrace(deps.telegaRoot, traceId);

      if (!hasExistingResult) {
        await ctx.answerCbQuery(MSG.cb.notFound);
        return;
      }

      const explain = explainTrace(deps.telegaRoot, traceId);
      const blocked = explain.status === "blocked";

      if (blocked) {
        const keyboard = Markup.inlineKeyboard([
          Markup.button.callback("🚀 Retry anyway", `retry_blocked:${traceId}`),
        ]);
        const text = [
          `🚫 *Trace blocked*`,
          ``,
          `Trace \`${traceId.slice(0, 16)}…\` is blocked and cannot be retried directly.`,
          hint ? `*Hint:* ${hint}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        await ctx.answerCbQuery(MSG.cb.blocked);
        await ctx.reply(text, { ...keyboard, parse_mode: "Markdown" as any });
        return;
      }

      const existing = explainTrace(deps.telegaRoot, traceId);
      if (existing.status === "success") {
        await ctx.answerCbQuery(MSG.cb.alreadyDone);
        return;
      }

      const result = retryBuildTask(deps.telegaRoot, traceId);
      if (!result?.ok) {
        await ctx.answerCbQuery(result?.error || MSG.cb.failed);
        return;
      }

      const text = [
        `🔄 *Retry queued*`,
        ``,
        `Trace: \`${traceId.slice(0, 16)}…\``,
        result.taskId ? `Task: \`${result.taskId}\`` : "",
        hint ? `*Hint:* ${hint}` : "",
        isLast ? "" : `⚠️ This is not the latest in the retry chain (${chain.length} steps). The latest is \`${chain[chain.length - 1].slice(0, 16)}…\``,
      ]
        .filter(Boolean)
        .join("\n");

      await ctx.answerCbQuery(MSG.cb.queued);
      await ctx.reply(text, { parse_mode: "Markdown" as any });
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^retry_blocked:([0-9a-fA-F-]{16,})$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const traceId = (ctx as any)?.match?.[1] || "";
      const result = retryBuildTask(deps.telegaRoot, traceId);
      if (!result?.ok) {
        await ctx.answerCbQuery(result?.error || MSG.cb.failed);
        return;
      }
      await ctx.answerCbQuery(MSG.cb.queued);
      const text = `🚀 *Blocked retry queued*\n\nTrace: \`${traceId.slice(0, 16)}…\``;
      await ctx.reply(text, { parse_mode: "Markdown" as any });
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^retry_chain:([0-9a-fA-F-]{16,})$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const traceId = (ctx as any)?.match?.[1] || "";
      const chain = walkRetryChain(deps.telegaRoot, traceId);
      const lines = chain.map((id: string, i: number) => {
        const info = explainTrace(deps.telegaRoot, id);
        const emoji = info.status === "success" ? "✅" : info.status === "failed" ? "❌" : "🟡";
        return `${i + 1}. ${emoji} \`${id.slice(0, 16)}…\` — ${info.status}`;
      });
      const text = [`🔄 *Retry chain* (${chain.length} steps)`, "", ...lines].join("\n");
      await ctx.answerCbQuery(MSG.cb.chain);
      await ctx.reply(text, { parse_mode: "Markdown" as any });
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action(/^results_page:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const pageRaw = Number((ctx as any)?.match?.[1] || 1);
      const page = Math.max(1, pageRaw);
      const payload = renderBuildResultsPayload(page, deps.telegaRoot, deps.PAGE_SIZE);
      await ctx.answerCbQuery(MSG.cb.results);
      await (ctx as any).reply(payload.text, payload.keyboard);
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });

  bot.action("voice:toggle", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-action] voice:toggle clicked", { user_id: uid, chat_id: chatIdStr, label });
      const newState = await toggleVoiceMode(chatIdStr, uid);
      const status = formatVoiceStatus(chatIdStr, uid, lang);
      await ctx.answerCbQuery(newState ? (lang === "ru" ? "Голос вкл" : "Voice on") : (lang === "ru" ? "Голос выкл" : "Voice off"));
      await ctx.reply(status);
    } catch (e: any) {
      console.error("[telegram-action] voice:toggle failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("voice:speak", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-action] voice:speak clicked", { user_id: uid, chat_id: chatIdStr, label });
      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }
      await ctx.answerCbQuery(lang === "ru" ? "Озвучиваю..." : "Speaking...");
      const voicePath = await handleTTSOutput(uid, chatIdStr, lastResponse.response || lastResponse.message);
      if (voicePath) {
        await ctx.replyWithVoice({ source: voicePath as any });
      }
    } catch (e: any) {
      console.error("[telegram-action] voice:speak failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action(/^forge:(refresh|gates|timeline|diagnose|heal|restart):(.+)$/, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const action = (ctx as any)?.match?.[1] || "";
      const workflowId = (ctx as any)?.match?.[2] || "";
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const label = deps.getAccountLabel(uid);
      console.log("[forge-ui] callback", { user_id: uid, label, action, workflow_id: workflowId });

      if (action === "refresh") {
        const wf = await getWorkflow(workflowId);
        if (!wf) { await ctx.answerCbQuery("Workflow not found", { show_alert: true }); return; }
        const { text, keyboard } = formatWorkflowCard(wf, lang);
        await ctx.editMessageText(text, { reply_markup: keyboard as any });
        await ctx.answerCbQuery("Refreshed");
      } else if (action === "gates") {
        const wf = await getWorkflow(workflowId);
        if (!wf) { await ctx.answerCbQuery("Workflow not found", { show_alert: true }); return; }
        const report = await checkGates(workflowId);
        const { text, keyboard } = formatWorkflowCard(wf, lang);
        const gateText = report
          ? `*Gates Report:*\n${report.map((g: any) => `• ${g.gate}: ${g.passed ? "✅" : "❌"} ${g.message || ""}`).join("\n")}`
          : "*No gates configured*";
        await ctx.editMessageText(`${text}\n\n${gateText}`, { reply_markup: keyboard as any });
        await ctx.answerCbQuery("Gates checked");
      } else if (action === "timeline") {
        const timeline = await getWorkflowTimeline(workflowId, lang as any);
        await ctx.reply(timeline || "No timeline events", { parse_mode: "Markdown" as any });
        await ctx.answerCbQuery("Timeline");
      } else if (action === "diagnose") {
        const diagnosis = await formatDiagnosis(workflowId, lang as any);
        await ctx.reply(diagnosis || "No diagnosis available", { parse_mode: "Markdown" as any });
        await ctx.answerCbQuery("Diagnosis");
      } else if (action === "heal") {
        const plan = await createHealPlan(workflowId, uid);
        const formatted = formatHealPlan(plan);
        await ctx.reply(formatted || "No heal plan created", { parse_mode: "Markdown" as any });
        await ctx.answerCbQuery("Heal plan created");
      } else if (action === "restart") {
        const result = await restartWorkflow(workflowId, uid);
        const { text, keyboard } = formatWorkflowCard(result, lang);
        await ctx.editMessageText(`🔄 *Restarting…*\n\n${text}`, { reply_markup: keyboard as any });
        await ctx.answerCbQuery("Restarting...");
      }

      await ctx.answerCbQuery("OK");
    } catch (e: any) {
      console.error("[forge-ui] callback failed", e?.message || e);
    }
  });

  bot.action("action_repeat", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-action] action_repeat clicked", { user_id: uid, chat_id: chatIdStr, label });
      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }
      await ctx.answerCbQuery(lang === "ru" ? "Повторяю..." : "Repeating...");
      await ctx.reply(`🔁 ${lastResponse.message}`);
      const res = await fetch("http://127.0.0.1:8787/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(65000),
        body: JSON.stringify({
          message: lastResponse.message,
          model: providerToModel(lastResponse.provider as TelegramProvider),
          task: { type: "chat" },
          meta: {
            source: "telegram",
            telegram_user_id: uid,
            chat_id: chatIdStr,
            from: String((ctx as any)?.from?.id || ""),
            message_id: (ctx as any)?.message?.message_id,
            bridge_enabled: lastResponse.bridgeEnabled === true,
            creator_mode: lastResponse.creatorMode === true,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      const output = String(data?.output || data?.reply || data?.answer || "").trim();
      if (output) {
        await ctx.reply(output);
        await saveActionResponse(chatIdStr, uid, lastResponse.message, output, lastResponse.provider, data?.request_id || String(Date.now()));
        const extra = buildReplyExtra(lang) as any;
        await ctx.reply("━━━━━━━━━━━━━━━━━━━━━━", extra);
        logAction("action_repeat", uid, chatIdStr, { original_message: lastResponse.message, output_length: output.length });
      } else {
        await ctx.reply("⚠️ Empty response from server.");
      }
    } catch (e: any) {
      console.error("[telegram-action] action_repeat failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_clarify", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-action] action_clarify clicked", { user_id: uid, chat_id: chatIdStr, label });
      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }
      await ctx.answerCbQuery(lang === "ru" ? "Уточняю..." : "Clarifying...");
      const clarifyBody = {
        message: `Я хочу уточнить. Вот исходный запрос: "${lastResponse.message}". Вот предыдущий ответ: "${(lastResponse.response || lastResponse.message || "").slice(0, 200)}". Пожалуйста, дай более точный/подробный ответ.`,
        model: providerToModel(lastResponse.provider as TelegramProvider),
        task: { type: "chat" },
        meta: {
          source: "telegram",
          telegram_user_id: uid,
          chat_id: chatIdStr,
          bridge_enabled: lastResponse.bridgeEnabled === true,
          creator_mode: lastResponse.creatorMode === true,
          from: String((ctx as any)?.from?.id || ""),
          message_id: (ctx as any)?.message?.message_id,
        },
      };
      const res = await fetch("http://127.0.0.1:8787/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(65000),
        body: JSON.stringify(clarifyBody),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      const output = String(data?.output || data?.reply || data?.answer || "").trim();
      if (output) {
        await ctx.reply(output);
        await saveActionResponse(chatIdStr, uid, lastResponse.message, output, lastResponse.provider, data?.request_id || String(Date.now()));
        const extra = buildReplyExtra(lang) as any;
        await ctx.reply("━━━━━━━━━━━━━━━━━━━━━━", extra);
        logAction("action_clarify", uid, chatIdStr, { original_message: lastResponse.message, output_length: output.length });
      } else {
        await ctx.reply("⚠️ Empty response from server.");
      }
    } catch (e: any) {
      console.error("[telegram-action] action_clarify failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_file", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-action] action_file clicked", { user_id: uid, chat_id: chatIdStr, label });
      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }
      await ctx.answerCbQuery(lang === "ru" ? "Готовлю файл..." : "Preparing file...");
      const content = lastResponse.response || lastResponse.message || "No content";
      const truncated = content.slice(0, 10000);
      const buf = Buffer.from(truncated, "utf-8");
      await ctx.replyWithDocument({ source: buf, filename: "response.txt" });
    } catch (e: any) {
      console.error("[telegram-action] action_file failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_read_aloud", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-action] action_read_aloud clicked", { user_id: uid, chat_id: chatIdStr, label });
      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }
      await ctx.answerCbQuery(lang === "ru" ? "Читаю вслух..." : "Reading aloud...");
      const voicePath = await handleTTSOutput(uid, chatIdStr, lastResponse.response || lastResponse.message);
      if (voicePath) {
        await ctx.replyWithVoice({ source: voicePath as any });
      }
    } catch (e: any) {
      console.error("[telegram-action] action_read_aloud failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_image", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-action] action_image clicked", { user_id: uid, chat_id: chatIdStr, label });
      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }
      await ctx.answerCbQuery(lang === "ru" ? "Генерирую изображение..." : "Generating image...");
      const imagePrompt = lastResponse.response || lastResponse.message || "No content";
      const imageResult = await generateImage(uid, imagePrompt);
      if (imageResult?.url) {
        await sendImageToTelegram(ctx, imageResult.url, `🎨 ${imagePrompt.slice(0, 200)}`);
      } else {
        await ctx.reply("❌ Image generation failed.");
      }
    } catch (e: any) {
      console.error("[telegram-action] action_image failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_provider", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      await ctx.answerCbQuery("Provider");
      await editOrReply(ctx, "Provider settings:", compactMenuKeyboard(role));
    } catch (e: any) {
      console.error("[telegram-action] action_provider failed", e?.message || e);
    }
  });

  bot.action("action_save", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = deps.getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      console.log("[telegram-action] action_save clicked", { user_id: uid, chat_id: chatIdStr, label });
      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }
      await ctx.answerCbQuery(lang === "ru" ? "Сохранено" : "Saved ✅");
      logAction("action_save", uid, chatIdStr, { saved_message: (lastResponse.response || lastResponse.message || "").slice(0, 100) });
      await ctx.reply(`💾 Saved (${(lastResponse.response || lastResponse.message || "").length} chars)`);
    } catch (e: any) {
      console.error("[telegram-action] action_save failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action(/^brback:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);
      const page = Math.max(1, Number((ctx as any)?.match?.[1] || 1));
      const payload = renderBuildResultsPayload(page, deps.telegaRoot, deps.PAGE_SIZE);
      gcPending();
      const k = keyOf(ctx);
      const lastMsg = lastResultsListMsg.get(k);
      if (lastMsg) {
        try {
          await ctx.telegram.editMessageText(ctx.chat!.id, lastMsg.message_id, undefined, payload.text, payload.keyboard as any);
        } catch {
          await (ctx as any).reply(payload.text, payload.keyboard);
        }
      } else {
        await (ctx as any).reply(payload.text, payload.keyboard);
      }
      await ctx.answerCbQuery(MSG.cb.back);
    } catch {
      try { await ctx.answerCbQuery(MSG.error); } catch {}
    }
  });
}
