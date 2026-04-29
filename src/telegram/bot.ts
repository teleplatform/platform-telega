import { Telegraf, Markup } from "telegraf";
import { buildIntelCard } from "../intel/intelParse.js";
import { saveIntelCard, loadIndex, listInboxJsonFiles, readIntelCardFile } from "../intel/intelStore.js";
import { runDigest, runDigestWeekly } from "../intel/intelDigest.js";
import fs from "fs";
import path from "path";
import { isIntelEnabled, isChatAllowed, setIntelEnabled } from "../intel/intelGate.js";
import { isMaker } from "../intel/makerGate.js";
import { writeBuildTaskFromPackCandidate, writeManualBuildTask } from "../intel/buildTask.js";
import { countBuildTasks, listBuildTasks, readBuildTask } from "../intel/buildTaskStore.js";
import { runOneBuildTask } from "../intel/buildTaskWorker.js";
import {
  listBuildResultsFromIndex,
  getBuildResultsCount,
  findBuildResultsByPack,
  findTaskIdByTrace,
} from "../intel/buildResultIndex.js";
import { traceExists } from "../intel/traceWriter.js";
import {
  explainTrace,
  formatTraceExplainWithDiff,
  walkRetryChain,
  buildReasonHintForSingleTrace,
} from "../intel/explainTrace.js";
import { retryBuildTask } from "../intel/retryBuildTask.js";
import { MSG } from "#i18n/messages";
import type { SessionProviderId } from "../providers/creator/session/adapters.js";
import { deliverFullOutput } from "../providers/creator/output-delivery.js";
import { detectLanguage } from "../providers/creator/i18n.js";
import { buildReplyExtra, saveResponse as saveActionResponse, getLastResponse, logAction } from "./action-buttons.js";
import {
  handleVoiceInput,
  handleTTSOutput,
  toggleVoiceMode,
  getVoiceSettings,
  isVoiceModeEnabled,
  formatVoiceStatus,
  buildVoiceKeyboard,
} from "./voice-layer.js";
import {
  generateImage,
  sendImageToTelegram,
  getUserImages,
  formatUserImages,
  getImageCommands,
} from "./image-layer.js";
import {
  checkMCPHealth,
  checkKiloStatus,
  callMCPTool,
  formatMCPStatus,
  formatKiloStatus,
  formatMCPTestResult,
  MCP_REQUIRED_TOOLS,
  checkRequiredTools,
} from "./mcp-bridge.js";
import {
  kiloPing,
  kiloWorkspace,
  kiloRead,
  kiloGrep,
  kiloStatus,
  KILO_READONLY_TOOLS,
  KILO_BLOCKED_TOOLS,
} from "./kilo-live.js";
import {
  createPatchPlan,
  previewPatch,
  applyPatch,
  verifyApply,
  rollbackApply,
  formatPatchList,
} from "./kilo-controlled-write.js";
import {
  createForgeTask,
  getForgeTask,
  updateForgeTask,
  listForgeTasks,
  handleForgeTask,
  formatForgeTask,
  formatForgeTaskList,
  canManageForgeTask,
} from "./forge-shell.js";
import {
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  executeStage,
  skipStage,
  restartWorkflow,
  formatWorkflowVisualization,
  formatWorkflowList,
  listWorkflows,
  STAGES,
  WorkflowStage,
  validateGate,
  checkGates,
  formatValidationReport,
} from "./forge-workflow.js";
import {
  addTimelineEvent,
  getWorkflowTimeline,
  exportReport,
} from "./forge-timeline.js";
import {
  initGraphNode,
  getGraphNode,
  updateNodeStatus,
  checkDependencies,
  formatGraph,
  formatQueue,
  linkToParent,
} from "./forge-graph.js";
import {
  saveCheckpoint,
  getLatestCheckpoint,
  getWorkflowCheckpoints,
  pauseWorkflow,
  resumeWorkflow,
  recoverWorkflow,
  formatCheckpointList,
  formatRecoveryReport,
} from "./forge-checkpoints.js";
import {
  classifyFailure,
  createHealPlan,
  getHealPlan,
  getWorkflowHealPlans,
  updateHealPlanStatus,
  formatHealPlan,
  formatDiagnosis,
} from "./forge-heal.js";
import {
  buildWorkflowKeyboard,
  buildTimelineKeyboard,
  formatWorkflowCard,
  formatProgressBar,
  formatGraphCard,
  formatErrorCard,
  canUseControl,
  parseCallback,
} from "./forge-ui.js";

function getTelegaRoot(): string {
  const root = (process.env.TELEGA_ROOT || "").trim();
  if (!root) {
    throw new Error("TELEGA_ROOT is not set");
  }
  return root;
}

function isPollingEnabled(): boolean {
  return process.env.PANTHEON_TG_POLLING === "1";
}

function chatId(ctx: any): string | number {
  return ctx?.chat?.id ?? "";
}

function isPrivate(ctx: any): boolean {
  return String(ctx?.chat?.type || "") === "private";
}

type TelegramRole = "owner" | "partner" | "public";
type TelegramProvider =
  | "auto"
  | "openai_web"
  | "qwen_web"
  | "deepseek_web"
  | "kimi_web"
  | "ollama_local";

type UserRuntimeSettings = {
  provider?: TelegramProvider;
  model?: string;
  bridgeEnabled?: boolean;
  creatorMode?: boolean;
};

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

function getTelegramRole(userId: string | number | undefined): TelegramRole {
  const id = String(userId || "");
  if (id === "267246987" || id === "1166943180") return "owner";
  if (id === "591948691") return "partner";
  return "public";
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
  const bot = new Telegraf(token);
  const PAGE_SIZE = 10;
  const userRuntimeSettings = new Map<string, UserRuntimeSettings>();
  const PROVIDERS: Array<{ id: TelegramProvider; label: string }> = [
    { id: "auto", label: "Auto" },
    { id: "openai_web", label: "OpenAI Web" },
    { id: "qwen_web", label: "Qwen Web" },
    { id: "deepseek_web", label: "DeepSeek Web" },
    { id: "kimi_web", label: "Kimi Web" },
    { id: "ollama_local", label: "Local/Ollama" },
  ];
  type PendingSearch = {
    kind: "build_results_search";
    created_at: number;
    page: number;
    list_message_id: number;
  };

  const pendingSearch = new Map<string, PendingSearch>();
  type LastResultsList = {
    message_id: number;
    page: number;
    updated_at: number;
  };
  const lastResultsListMsg = new Map<string, LastResultsList>();

  function keyOf(ctx: any) {
    const uid = String(ctx?.from?.id || "");
    const chatId = String(ctx?.chat?.id || "");
    return `${chatId}:${uid}`;
  }

  function userIdOf(ctx: any): string {
    return String(ctx?.from?.id || "");
  }

  function settingsOf(ctx: any): UserRuntimeSettings {
    const uid = userIdOf(ctx);
    const current = userRuntimeSettings.get(uid);
    if (current) return current;
    const next: UserRuntimeSettings = {
      provider: "auto",
      model: providerToModel("auto"),
      bridgeEnabled: false,
      creatorMode: false,
    };
    userRuntimeSettings.set(uid, next);
    return next;
  }

  function providerToModel(provider: TelegramProvider | undefined): string {
    switch (provider || "auto") {
      case "openai_web":
        return "openai_web:gpt-4o-mini";
      case "qwen_web":
        return "qwen_web:qwen-plus";
      case "deepseek_web":
        return "deepseek_web:deepseek-r1";
      case "kimi_web":
        return "kimi_web:kimi-k2.5";
      case "ollama_local":
        return "qwen2.5:7b-instruct";
      case "auto":
      default:
        return "openai:gpt-4o-mini";
    }
  }

  function providerLabel(provider: TelegramProvider | undefined): string {
    return PROVIDERS.find((p) => p.id === provider)?.label || "Auto";
  }

  function compactMenuKeyboard(role: TelegramRole) {
    if (role === "owner") {
      return Markup.inlineKeyboard([
        [Markup.button.callback("🤖 Chat", "menu:chat"), Markup.button.callback("🧠 Providers", "menu:providers")],
        [Markup.button.callback("🌉 Creator Bridge", "menu:bridge")],
        [Markup.button.callback("⚙️ Settings", "menu:settings")],
        [Markup.button.callback("❌ Collapse", "menu:collapse")],
      ]);
    }
    if (role === "partner") {
      return Markup.inlineKeyboard([
        [Markup.button.callback("🤖 Chat", "menu:chat"), Markup.button.callback("🧠 Providers", "menu:providers")],
        [Markup.button.callback("⚙️ Settings", "menu:settings")],
        [Markup.button.callback("❌ Collapse", "menu:collapse")],
      ]);
    }
    return Markup.inlineKeyboard([
      [Markup.button.callback("🤖 Chat", "menu:chat")],
      [Markup.button.callback("❓ Help", "menu:help"), Markup.button.callback("⚙️ Settings", "menu:settings")],
      [Markup.button.callback("❌ Collapse", "menu:collapse")],
    ]);
  }

  function menuButtonKeyboard() {
    return Markup.inlineKeyboard([[Markup.button.callback("▦ Menu", "menu:main")]]);
  }

  function providerKeyboard(ctx: any) {
    const settings = settingsOf(ctx);
    const role = getTelegramRole(userIdOf(ctx));
    const rows = PROVIDERS.map((provider) => {
      const selected = (settings.provider || "auto") === provider.id ? "✅ " : "";
      const callback =
        role === "public"
          ? "provider:view"
          : `provider:set:${provider.id}`;
      return [Markup.button.callback(`${selected}${provider.label}`, callback)];
    });
    rows.push([Markup.button.callback("⬅️ Back", "menu:main")]);
    return Markup.inlineKeyboard(rows);
  }

  function bridgeKeyboard(ctx: any) {
    const settings = settingsOf(ctx);
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `Bridge ${settings.bridgeEnabled ? "ON" : "OFF"}`,
          "bridge:toggle"
        ),
      ],
      [
        Markup.button.callback(
          `Creator Mode ${settings.creatorMode ? "ON" : "OFF"}`,
          "creator:toggle"
        ),
      ],
      [Markup.button.callback(`Current provider: ${providerLabel(settings.provider)}`, "menu:providers")],
      [Markup.button.callback("Health check", "bridge:health")],
      [Markup.button.callback("⬅️ Back", "menu:main")],
    ]);
  }

  async function showCompactMenu(ctx: any) {
    const role = getTelegramRole(userIdOf(ctx));
    const settings = settingsOf(ctx);
    const text =
      `Tele•GPT\n` +
      `Role: ${role}\n` +
      `Provider: ${providerLabel(settings.provider)}\n` +
      `Model: ${settings.model || providerToModel(settings.provider)}\n` +
      `Bridge: ${settings.bridgeEnabled ? "ON" : "OFF"}\n` +
      `Creator Mode: ${settings.creatorMode ? "ON" : "OFF"}`;
    await editOrReply(ctx, text, compactMenuKeyboard(role));
  }

  async function editOrReply(ctx: any, text: string, extra?: any) {
    try {
      if (ctx.callbackQuery?.message) {
        await ctx.editMessageText(text, extra);
        return;
      }
    } catch {
      // fall back to reply
    }
    await ctx.reply(text, extra);
  }

  function gcPending() {
    const now = Date.now();
    for (const [k, v] of pendingSearch.entries()) {
      if (now - v.created_at > 60_000) pendingSearch.delete(k);
    }
    for (const [k, v] of lastResultsListMsg.entries()) {
      if (now - v.updated_at > 10 * 60_000) lastResultsListMsg.delete(k);
    }
  }

  function renderBuildResultsPayload(page: number) {
    const p = Math.max(1, page | 0);
    const offset = (p - 1) * PAGE_SIZE;

    const items = listBuildResultsFromIndex(telegaRoot, PAGE_SIZE, offset);
    const lines = items.length
      ? items.map((it, i) => {
          const when = (it.created_at || "").slice(11, 19) || "??:??:??";
          const art0 = it.artifacts?.[0]?.path ? ` • ${it.artifacts[0].path}` : "";
          const err = it.status === "failed" && it.error?.message ? ` • err: ${it.error.message}` : "";
          return `${offset + i + 1}) ${when} • ${it.pack} • ${it.status} • ${it.id}${art0}${err}`;
        })
      : ["(empty)"];

    const rows: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const row: any[] = [];
      row.push(Markup.button.callback(`📦 #${offset + i + 1} ${it.pack}`, `br:${it.id}`));
      if (it.trace_id) {
      row.push(Markup.button.callback(MSG.btn.explainSource, `trace:${it.trace_id}`));
      }
      rows.push(row);
    }

    const total = getBuildResultsCount(telegaRoot);
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const nav: any[] = [];
    if (p > 1) nav.push(Markup.button.callback("⬅️ Prev", `brp:${p - 1}`));
    nav.push(Markup.button.callback("⏪ -10", `brj:${p}:-10`));
    nav.push(Markup.button.callback("🔄 Refresh", `brr:${p}`));
    nav.push(Markup.button.callback("🔍 Search", `brs:${p}`));
    if (p < lastPage) nav.push(Markup.button.callback("В конец ⏭️", `brl:${lastPage}`));
    nav.push(Markup.button.callback("+10 ⏩", `brj:${p}:10`));
    if (items.length === PAGE_SIZE) nav.push(Markup.button.callback("Next ➡️", `brp:${p + 1}`));
    rows.push(nav);
    rows.push([Markup.button.callback("🗑 Очистить", "brc:1")]);

    const text = `📚 Результаты (страница ${p}, последние ${PAGE_SIZE})\n${lines.join("\n")}\n\nНажми кнопку чтобы открыть результат:`;
    return { text, keyboard: Markup.inlineKeyboard(rows) };
  }

  bot.command("start", async (ctx) => {
    try {
      console.log("[telegram-menu] menu_open_requested", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
      console.log("[creator-control] /start", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
      await ctx.reply("Tele•GPT ready. Open compact menu:", menuButtonKeyboard());
    } catch (e: any) {
      console.error("[creator-control] /start failed", e?.message || e);
    }
  });

  bot.command("menu", async (ctx) => {
    try {
      console.log("[telegram-menu] menu_open_requested", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
      console.log("[creator-control] /menu", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
      await ctx.reply("Tele•GPT compact menu:", menuButtonKeyboard());
    } catch (e: any) {
      console.error("[creator-control] /menu failed", e?.message || e);
    }
  });

  bot.command("bridge_status", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { formatProviderHealth } = await import("../providers/creator/evidence-store.js");
      await ctx.reply(formatProviderHealth());
    } catch (e: any) {
      console.error("[creator-control] /bridge_status failed", e?.message || e);
    }
  });

  bot.command("bridge_evidence", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { bridgeEvidenceStore, formatEvidenceSummary } = await import("../providers/creator/evidence-store.js");
      const recent = bridgeEvidenceStore.getRecent(5);
      if (recent.length === 0) {
        await ctx.reply("No bridge evidence yet");
        return;
      }
      const lines = recent.map(formatEvidenceSummary);
      await ctx.reply(lines.join("\n\n"));
    } catch (e: any) {
      console.error("[creator-control] /bridge_evidence failed", e?.message || e);
    }
  });

  bot.command("bridge_failures", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { bridgeEvidenceStore, formatEvidenceSummary } = await import("../providers/creator/evidence-store.js");
      const failed = bridgeEvidenceStore.getFailed(5);
      if (failed.length === 0) {
        await ctx.reply("No recent failures");
        return;
      }
      const lines = failed.map(formatEvidenceSummary);
      await ctx.reply(lines.join("\n\n"));
    } catch (e: any) {
      console.error("[creator-control] /bridge_failures failed", e?.message || e);
    }
  });

  bot.command("provider_health", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { formatProviderHealth } = await import("../providers/creator/evidence-store.js");
      await ctx.reply(formatProviderHealth());
    } catch (e: any) {
      console.error("[creator-control] /provider_health failed", e?.message || e);
    }
  });

  bot.command("bridge_reset_provider", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const provider = args[0] as SessionProviderId;
      if (!provider) {
        await ctx.reply("Usage: /bridge_reset_provider <provider>\nExample: /bridge_reset_provider grok_web");
        return;
      }
      const { providerCooldownManager } = await import("../providers/creator/evidence-store.js");
      providerCooldownManager.reset(provider);
      await ctx.reply(`✅ Cooldown reset for ${provider}`);
    } catch (e: any) {
      console.error("[creator-control] /bridge_reset_provider failed", e?.message || e);
    }
  });

  bot.command("bridge_strategy", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const message = args.join(" ");
      if (!message) {
        await ctx.reply("Usage: /bridge_strategy <your question>\nExample: /bridge_strategy What is the latest AI news?");
        return;
      }
      const { buildStrategyWithGuardrails, formatStrategySummary } = await import("../providers/creator/strategy-engine.js");
      await ctx.reply("🧠 Analyzing...");
      const { strategy, evidence, usedFallback } = await buildStrategyWithGuardrails(message, `tg-${Date.now()}`);
      const summary = formatStrategySummary(strategy);
      const verbose = `${summary}\n\n📋 Evidence:\n${JSON.stringify(evidence, null, 2)}`;
      await deliverFullOutput(ctx, usedFallback ? `⚠️ Fallback used
${verbose}` : verbose, {
        title: "🧠 Strategy Analysis",
        reply_to_message_id: ctx.message?.message_id,
      });
    } catch (e: any) {
      console.error("[creator-control] /bridge_strategy failed", e?.message || e);
    }
  });

  bot.command("bridge_strategy_verbose", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const message = args.join(" ");
      if (!message) {
        await ctx.reply("Usage: /bridge_strategy_verbose <your question>");
        return;
      }
      const { buildStrategyWithGuardrails, formatStrategySummary } = await import("../providers/creator/strategy-engine.js");
      await ctx.reply("🧠 Analyzing with guardrails...");
      const { strategy, evidence, usedFallback } = await buildStrategyWithGuardrails(message, `tg-${Date.now()}`);
      await ctx.reply(formatStrategySummary(strategy));
      await ctx.reply(`📋 Evidence:\n\`\`\`\n${JSON.stringify(evidence, null, 2)}\n\`\`\``);
    } catch (e: any) {
      console.error("[creator-control] /bridge_strategy_verbose failed", e?.message || e);
    }
  });

  bot.command("jobs", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      const { listJobs, listAllJobs, formatJobStatus } = await import("../providers/creator/job-runtime.js");
      
      const jobs = role === "owner" ? listAllJobs(10) : listJobs(userId, 5);
      if (jobs.length === 0) {
        await ctx.reply("No jobs");
        return;
      }
      for (const job of jobs) {
        await ctx.reply(formatJobStatus(job));
      }
    } catch (e: any) {
      console.error("[creator-control] /jobs failed", e?.message || e);
    }
  });

  bot.command("job_status", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const jobId = args[0];
      if (!jobId) {
        await ctx.reply("Usage: /job_status <job_id>");
        return;
      }
      const { getJob, formatJobStatus } = await import("../providers/creator/job-runtime.js");
      const job = getJob(jobId);
      if (!job) {
        await ctx.reply("Job not found");
        return;
      }
      if (job.user_id !== userId && getTelegramRole(userId) !== "owner") {
        await ctx.reply("Not your job");
        return;
      }
      await ctx.reply(formatJobStatus(job));
    } catch (e: any) {
      console.error("[creator-control] /job_status failed", e?.message || e);
    }
  });

  bot.command("cancel_job", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const jobId = args[0];
      if (!jobId) {
        await ctx.reply("Usage: /cancel_job <job_id>");
        return;
      }
      const { getJob, cancelJob } = await import("../providers/creator/job-runtime.js");
      const job = getJob(jobId);
      if (!job) {
        await ctx.reply("Job not found");
        return;
      }
      if (job.user_id !== userId && role !== "owner") {
        await ctx.reply("Not your job");
        return;
      }
      const success = cancelJob(jobId, userId);
      await ctx.reply(success ? `✅ Job ${jobId} cancelled` : `❌ Failed to cancel`);
    } catch (e: any) {
      console.error("[creator-control] /cancel_job failed", e?.message || e);
    }
  });

  bot.command("bridge_load", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { formatGovernorState } = await import("../providers/creator/governor.js");
      await ctx.reply(formatGovernorState());
    } catch (e: any) {
      console.error("[creator-control] /bridge_load failed", e?.message || e);
    }
  });

  bot.command("provider_cooldowns", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { formatGovernorState } = await import("../providers/creator/governor.js");
      await ctx.reply(formatGovernorState());
    } catch (e: any) {
      console.error("[creator-control] /provider_cooldowns failed", e?.message || e);
    }
  });

  bot.command("bridge_memory", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { formatMemorySummary } = await import("../providers/creator/execution-memory.js");
      await ctx.reply(await formatMemorySummary());
    } catch (e: any) {
      console.error("[creator-control] /bridge_memory failed", e?.message || e);
    }
  });

  bot.command("bridge_memory_find", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const query = args.join(" ");
      if (!query) {
        await ctx.reply("Usage: /bridge_memory_find <query>");
        return;
      }
      const { findMemory } = await import("../providers/creator/execution-memory.js");
      await ctx.reply(await findMemory(query));
    } catch (e: any) {
      console.error("[creator-control] /bridge_memory_find failed", e?.message || e);
    }
  });

  bot.command("bridge_tools", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { formatToolList } = await import("../providers/creator/tool-gateway.js");
      await ctx.reply(formatToolList());
    } catch (e: any) {
      console.error("[creator-control] /bridge_tools failed", e?.message || e);
    }
  });

  bot.command("bridge_tool_test", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const command = args.join(" ");
      if (!command) {
        await ctx.reply("Usage: /bridge_tool_test <command>\nExample: /bridge_tool_test git status");
        return;
      }
      const { executeTool } = await import("../providers/creator/tool-gateway.js");
      const result = await executeTool("shell_readonly", { command }, true);
      if (result.ok) {
        await ctx.reply(`✅ Output:\n${result.output.slice(0, 4000)}`);
      } else {
        await ctx.reply(`❌ Error: ${result.error}`);
      }
    } catch (e: any) {
      console.error("[creator-control] /bridge_tool_test failed", e?.message || e);
    }
  });

  bot.command("patch_plan", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { isTaskAllowed, createPatchPlan, formatPatchPlan } = await import("../providers/creator/patch-planner.js");
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const task = args.join(" ");
      if (!task) {
        await ctx.reply("Usage: /patch_plan <task description>\nExample: /patch_plan Add logging to the router");
        return;
      }
      const check = isTaskAllowed(task);
      if (!check.allowed) {
        await ctx.reply(`❌ ${check.reason}`);
        return;
      }
      await ctx.reply("Creating patch plan...");
      const files = [
        { path: "TBD", reason: task, change_summary: "Auto-generated from task", risk_level: "medium" as const },
      ];
      const patch = await createPatchPlan(task, files);
      await ctx.reply(formatPatchPlan(patch));
    } catch (e: any) {
      console.error("[creator-control] /patch_plan failed", e?.message || e);
    }
  });

  bot.command("patch_plans", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { listPatchPlans, formatPatchPlan } = await import("../providers/creator/patch-planner.js");
      const patches = await listPatchPlans("pending", 5);
      if (patches.length === 0) {
        await ctx.reply("No pending patch plans");
        return;
      }
      for (const patch of patches) {
        await ctx.reply(formatPatchPlan(patch));
      }
    } catch (e: any) {
      console.error("[creator-control] /patch_plans failed", e?.message || e);
    }
  });

  bot.command("patch_plan_view", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const patchId = args[0];
      if (!patchId) {
        await ctx.reply("Usage: /patch_plan_view <patch_id>");
        return;
      }
      const { getPatchPlan, formatPatchPlan } = await import("../providers/creator/patch-planner.js");
      const patch = await getPatchPlan(patchId);
      if (!patch) {
        await ctx.reply("Patch plan not found");
        return;
      }
      await ctx.reply(formatPatchPlan(patch));
    } catch (e: any) {
      console.error("[creator-control] /patch_plan_view failed", e?.message || e);
    }
  });

  bot.command("patch_apply", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const patchId = args[0];
      if (!patchId) {
        await ctx.reply("Usage: /patch_apply <patch_id>\n⚠️ Only after patch plan is reviewed and approved");
        return;
      }
      const { applyPatch, verifyApply, formatApplyStatus } = await import("../providers/creator/apply-gateway.js");
      const { getPatchPlan: loadPatchPlan } = await import("../providers/creator/patch-planner.js");
      const patch = await loadPatchPlan(patchId);
      if (!patch) {
        await ctx.reply("Patch plan not found");
        return;
      }
      await ctx.reply("Creating backup and applying...");
      const userId = String(userIdOf(ctx));
      const record = await applyPatch(patchId, userId, patch);
      await ctx.reply(formatApplyStatus(record) + "\n\nVerifying...");
      const verified = await verifyApply(record.apply_id);
      await ctx.reply(formatApplyStatus(verified));
    } catch (e: any) {
      console.error("[creator-control] /patch_apply failed", e?.message || e);
    }
  });

  bot.command("patch_status", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const applyId = args[0];
      if (!applyId) {
        await ctx.reply("Usage: /patch_status <apply_id>");
        return;
      }
      const { getApplyStatus, formatApplyStatus } = await import("../providers/creator/apply-gateway.js");
      const record = await getApplyStatus(applyId);
      if (!record) {
        await ctx.reply("Apply not found");
        return;
      }
      await ctx.reply(formatApplyStatus(record));
    } catch (e: any) {
      console.error("[creator-control] /patch_status failed", e?.message || e);
    }
  });

  bot.command("patch_rollback", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const applyId = args[0];
      if (!applyId) {
        await ctx.reply("Usage: /patch_rollback <apply_id>");
        return;
      }
      const { getApplyStatus, rollbackApply, formatApplyStatus } = await import("../providers/creator/apply-gateway.js");
      const record = await getApplyStatus(applyId);
      if (!record) {
        await ctx.reply("Apply not found");
        return;
      }
      await ctx.reply("Rolling back...");
      const rolled = await rollbackApply(applyId);
      await ctx.reply(formatApplyStatus(rolled));
    } catch (e: any) {
console.error("[creator-control] /patch_rollback failed", e?.message || e);
    }
  });

  bot.command("bridge_audit", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const { formatAuditSummary } = await import("../providers/creator/audit-gateway.js");
      await ctx.reply(await formatAuditSummary(10));
    } catch (e: any) {
      console.error("[creator-control] /bridge_audit failed", e?.message || e);
    }
  });

  bot.command("bridge_audit_find", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const query = args.join(" ");
      if (!query) {
        await ctx.reply("Usage: /bridge_audit_find <query>");
        return;
      }
      const { findAudit, formatAuditRecord } = await import("../providers/creator/audit-gateway.js");
      const results = await findAudit(query, 5);
      if (results.length === 0) {
        await ctx.reply("No matches");
        return;
      }
      for (const r of results) {
        await ctx.reply(await formatAuditRecord(r));
      }
    } catch (e: any) {
      console.error("[creator-control] /bridge_audit_find failed", e?.message || e);
    }
  });

  bot.command("bridge_audit_view", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const auditId = args[0];
      if (!auditId) {
        await ctx.reply("Usage: /bridge_audit_view <audit_id>");
        return;
      }
      const { getAuditById, formatAuditRecord } = await import("../providers/creator/audit-gateway.js");
      const record = await getAuditById(auditId);
      if (!record) {
        await ctx.reply("Audit not found");
        return;
      }
      await ctx.reply(await formatAuditRecord(record));
    } catch (e: any) {
      console.error("[creator-control] /bridge_audit_view failed", e?.message || e);
    }
  });

  bot.command("me", async (ctx) => {
    try {
      const { getOrCreateUser, formatUserProfile } = await import("../providers/creator/user-layer.js");
      const userId = userIdOf(ctx);
      const telegramRole = getTelegramRole(userId);
      const role: "owner" | "creator" | "public" = telegramRole === "owner" ? "owner" : telegramRole === "partner" ? "creator" : "public";
      const user = await getOrCreateUser(String(userId), role);
      await ctx.reply(formatUserProfile(user));
    } catch (e: any) {
      console.error("[creator-control] /me failed", e?.message || e);
    }
  });

  bot.command("plan", async (ctx) => {
    try {
      const { getOrCreateUser, formatPlanInfo } = await import("../providers/creator/user-layer.js");
      const userId = userIdOf(ctx);
      const telegramRole = getTelegramRole(userId);
      const role: "owner" | "creator" | "public" = telegramRole === "owner" ? "owner" : telegramRole === "partner" ? "creator" : "public";
      const user = await getOrCreateUser(String(userId), role);
      await ctx.reply(formatPlanInfo(user.plan));
    } catch (e: any) {
      console.error("[creator-control] /plan failed", e?.message || e);
    }
  });

  bot.command("limits", async (ctx) => {
    try {
      const { getOrCreateUser, checkUserLimits, formatUserProfile } = await import("../providers/creator/user-layer.js");
      const userId = userIdOf(ctx);
      const telegramRole = getTelegramRole(userId);
      const role: "owner" | "creator" | "public" = telegramRole === "owner" ? "owner" : telegramRole === "partner" ? "creator" : "public";
      const user = await getOrCreateUser(String(userId), role);
      const check = checkUserLimits(user);
      const lines = [
        `📊 Limits Status`,
        `Allowed: ${check.allowed ? "✅" : "❌"}`,
        check.reason ? `Reason: ${check.reason}` : "",
        `\nActive jobs: ${user.usage.activeJobs}/${user.limits.maxActiveJobs}`,
        `Pending jobs: ${user.usage.pendingJobs}/${user.limits.maxPendingJobs}`,
        `Daily requests: ${user.usage.dailyRequests}/${user.limits.dailyRequests}`,
      ];
      await ctx.reply(lines.filter(Boolean).join("\n"));
    } catch (e: any) {
      console.error("[creator-control] /limits failed", e?.message || e);
    }
  });

  bot.command("upgrade", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role === "owner") {
        await ctx.reply("✅ You have full creator plan!");
      } else {
        await ctx.reply("📦 Upgrade plans available:\n\nfree: 2 jobs, basic providers\npro: 5 jobs, tools, patch plan\ncreator: unlimited, full access\n\nContact @owner for upgrade.");
      }
    } catch (e: any) {
      console.error("[creator-control] /upgrade failed", e?.message || e);
    }
  });

  const userLanguages: Record<string, "ru" | "en"> = {};
  
  function getUserLang(ctx: any): "ru" | "en" {
    const uid = String(userIdOf(ctx));
    if (userLanguages[uid]) return userLanguages[uid];
    const code = ctx.from?.language_code;
    if (code?.startsWith("en")) return "en";
    return "ru";
  }
  
  function setUserLang(ctx: any, lang: "ru" | "en") {
    const uid = String(userIdOf(ctx));
    userLanguages[uid] = lang;
  }

  bot.command("lang", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const lang = args[0]?.toLowerCase();
      
      if (lang === "ru" || lang === "en") {
        setUserLang(ctx, lang);
        const { t } = await import("../providers/creator/i18n.js");
        await ctx.reply(t("language_set", lang as "ru" | "en"));
      } else {
        const { t, detectLanguage } = await import("../providers/creator/i18n.js");
        const currentLang = getUserLang(ctx);
        await ctx.reply(t("current_language", currentLang));
      }
    } catch (e: any) {
      console.error("[creator-control] /lang failed", e?.message || e);
    }
  });

  bot.command("agents", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      const { getUserAgents, getAllAgents, formatAgentList } = await import("../providers/creator/agent-runtime.js");
      
      const agents = role === "owner" ? await getAllAgents() : await getUserAgents(userId);
      await ctx.reply(formatAgentList(agents));
    } catch (e: any) {
      console.error("[creator-control] /agents failed", e?.message || e);
    }
  });

  bot.command("agent_create", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      if (role === "public") {
        await ctx.reply("Agents require creator or higher plan");
        return;
      }
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      if (args.length < 2) {
        await ctx.reply("Usage: /agent_create <name> | <purpose>\nExample: /agent_create research_bot | Search and summarize AI news");
        return;
      }
      
      const sepIdx = args.indexOf("|");
      if (sepIdx === -1) {
        await ctx.reply("Missing purpose. Use: /agent_create <name> | <purpose>");
        return;
      }
      
      const name = args.slice(0, sepIdx).join(" ");
      const purpose = args.slice(sepIdx + 1).join(" ");
      const modeArg = args.find(a => a.startsWith("mode:"))?.replace("mode:", "") || "research";
      
      const { createAgent, getDefaultToolsForMode, getDefaultProvidersForMode, formatAgent } = await import("../providers/creator/agent-runtime.js");
      
      const agent = await createAgent(
        userId,
        name,
        purpose,
        modeArg as any,
        getDefaultToolsForMode(modeArg as any),
        getDefaultProvidersForMode(modeArg as any)
      );
      
      await ctx.reply(`Agent created:\n\n${formatAgent(agent)}`);
    } catch (e: any) {
      console.error("[creator-control] /agent_create failed", e?.message || e);
    }
  });

  bot.command("agent_run", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      if (role === "public") {
        await ctx.reply("Agents require creator or higher plan");
        return;
      }
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const agentId = args[0];
      const input = args.slice(1).join(" ");
      
      if (!agentId || !input) {
        await ctx.reply("Usage: /agent_run <agent_id> <input>\nExample: /agent_run agent_123_abc What is the latest AI news?");
        return;
      }
      
      const { getAgent, startAgentRun, checkAgentRunLimit, formatAgentRuns, loadAgentRuns } = await import("../providers/creator/agent-runtime.js");
      
      const agent = await getAgent(agentId, userId);
      if (!agent) {
        await ctx.reply("Agent not found or not yours");
        return;
      }
      
      const limitCheck = await checkAgentRunLimit(agentId);
      if (!limitCheck.allowed) {
        await ctx.reply(`❌ ${limitCheck.reason}`);
        return;
      }
      
      const run = await startAgentRun(agentId, input);
      
      await ctx.reply(`🚀 Agent run started!\n\nRun ID: ${run.run_id}\nAgent: ${agent.name}\nInput: ${input}`);
    } catch (e: any) {
      console.error("[creator-control] /agent_run failed", e?.message || e);
      await ctx.reply(`❌ Error: ${e?.message || e}`);
    }
  });

  bot.command("agent_status", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const agentId = args[0];
      
      if (!agentId) {
        await ctx.reply("Usage: /agent_status <agent_id>");
        return;
      }
      
      const { getAgent, formatAgent, checkAgentRunLimit } = await import("../providers/creator/agent-runtime.js");
      
      const agent = await getAgent(agentId, role === "owner" ? undefined : userId);
      if (!agent) {
        await ctx.reply("Agent not found");
        return;
      }
      
      const limitCheck = await checkAgentRunLimit(agentId);
      const limitInfo = limitCheck.allowed ? "✅ Can run" : `❌ ${limitCheck.reason}`;
      
      await ctx.reply(formatAgent(agent) + `\n\nRun today: ${limitInfo}`);
    } catch (e: any) {
      console.error("[creator-control] /agent_status failed", e?.message || e);
    }
  });

  bot.command("agent_runs", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const agentId = args[0];
      
      if (!agentId) {
        await ctx.reply("Usage: /agent_runs <agent_id>");
        return;
      }
      
      const { getAgent, loadAgentRuns, formatAgentRuns } = await import("../providers/creator/agent-runtime.js");
      
      const agent = await getAgent(agentId, role === "owner" ? undefined : userId);
      if (!agent) {
        await ctx.reply("Agent not found");
        return;
      }
      
      const runs = await loadAgentRuns(agentId);
      await ctx.reply(formatAgentRuns(runs));
    } catch (e: any) {
      console.error("[creator-control] /agent_runs failed", e?.message || e);
    }
  });

  bot.command("agent_pause", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const agentId = args[0];
      
      if (!agentId) {
        await ctx.reply("Usage: /agent_pause <agent_id>");
        return;
      }
      
      const { getAgent, updateAgentStatus } = await import("../providers/creator/agent-runtime.js");
      
      const agent = await getAgent(agentId, role === "owner" ? undefined : userId);
      if (!agent) {
        await ctx.reply("Agent not found");
        return;
      }
      
      await updateAgentStatus(agentId, "paused", role === "owner" ? undefined : userId);
      await ctx.reply(`⏸️ Agent paused: ${agent.name}`);
    } catch (e: any) {
      console.error("[creator-control] /agent_pause failed", e?.message || e);
    }
  });

  bot.command("agent_resume", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const agentId = args[0];
      
      if (!agentId) {
        await ctx.reply("Usage: /agent_resume <agent_id>");
        return;
      }
      
      const { getAgent, updateAgentStatus } = await import("../providers/creator/agent-runtime.js");
      
      const agent = await getAgent(agentId, role === "owner" ? undefined : userId);
      if (!agent) {
        await ctx.reply("Agent not found");
        return;
      }
      
      await updateAgentStatus(agentId, "active", role === "owner" ? undefined : userId);
      await ctx.reply(`▶️ Agent resumed: ${agent.name}`);
    } catch (e: any) {
      console.error("[creator-control] /agent_resume failed", e?.message || e);
    }
  });

  bot.command("telega_workflows", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const { loadWorkflows, formatWorkflowList, formatWorkflowTypes } = await import("../providers/creator/telega-integration.js");
      const workflows = await loadWorkflows(userId, 10);
      await ctx.reply(formatWorkflowList(workflows) + "\n\n" + formatWorkflowTypes());
    } catch (e: any) {
      console.error("[telega] /telega_workflows failed", e?.message || e);
    }
  });

  bot.command("telega_product_card", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const input = args.join(" ");
      
      if (!input) {
        await ctx.reply("Usage: /telega_product_card <product description>\nExample: /telega_product_card iPhone 15 Pro 256GB");
        return;
      }
      
      const { createWorkflow, updateWorkflow, generateProductCard, formatWorkflow, detectWorkflowType } = await import("../providers/creator/telega-integration.js");
      
      const workflow = await createWorkflow(userId, "product_card", input, "ru");
      await updateWorkflow(workflow.workflow_id, { status: "running" });
      
      const result = await generateProductCard(input, "ru");
      
      await updateWorkflow(workflow.workflow_id, {
        status: "completed",
        output: result,
        quality_score: result.quality_score,
        suggestions: result.suggestions,
      });
      
      const output = `📦 Product Card Generated\n\n` +
        `🎯 Title:\n${result.title}\n\n` +
        `📝 Description:\n${result.description}\n\n` +
        `🏷️ Tags: ${result.tags.join(", ")}\n\n` +
        `📂 Category: ${result.category}\n\n` +
        `⭐ Quality: ${result.quality_score}%\n\n` +
        `💡 Suggestions:\n${result.suggestions.map(s => "• " + s).join("\n")}`;
      
      await ctx.reply(output);
    } catch (e: any) {
      console.error("[telega] /telega_product_card failed", e?.message || e);
      await ctx.reply(`❌ Error: ${e?.message || e}`);
    }
  });

  bot.command("telega_research", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const query = args.join(" ");
      
      if (!query) {
        await ctx.reply("Usage: /telega_research <research query>\nExample: /telega_research competitors in electronics market");
        return;
      }
      
      await ctx.reply(`🔍 Research started: "${query}"\n\nThis requires strategy execution with perplexity_web.\nUse /bridge_strategy for detailed research.`);
      
      const { createWorkflow, updateWorkflow } = await import("../providers/creator/telega-integration.js");
      const workflow = await createWorkflow(userId, "market_research", query, "ru");
      await updateWorkflow(workflow.workflow_id, { status: "running", provider: "perplexity_web" });
      
    } catch (e: any) {
      console.error("[telega] /telega_research failed", e?.message || e);
      await ctx.reply(`❌ Error: ${e?.message || e}`);
    }
  });

  bot.command("telega_content", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const query = args.join(" ");
      
      if (!query) {
        await ctx.reply("Usage: /telega_content <topic>\nExample: /telega_content new collection promotion");
        return;
      }
      
      await ctx.reply(`📝 Content generation started: "${query}"\n\nUse /bridge_strategy for detailed content generation.`);
      
      const { createWorkflow, updateWorkflow } = await import("../providers/creator/telega-integration.js");
      const workflow = await createWorkflow(userId, "content", query, "ru");
      await updateWorkflow(workflow.workflow_id, { status: "running" });
      
    } catch (e: any) {
      console.error("[telega] /telega_content failed", e?.message || e);
      await ctx.reply(`❌ Error: ${e?.message || e}`);
    }
  });

  bot.command("telega_ops", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      
      const { loadWorkflows, loadActionResults } = await import("../providers/creator/telega-integration.js");
      const { formatProviderHealth } = await import("../providers/creator/evidence-store.js");
      const { formatAuditSummary } = await import("../providers/creator/audit-gateway.js");
      
      const workflows = await loadWorkflows(undefined, 5);
      const results = await loadActionResults(undefined, 5);
      
      const lines = [
        "📊 Tele•Ga Ops Report",
        "",
        "📋 Recent Workflows:",
        workflows.map(w => `• ${w.type}: ${w.status}`).join("\n") || "none",
        "",
        "📋 Recent Results:",
        results.map(r => `• ${r.action_type}: ${r.approved ? "approved" : "pending"}`).join("\n") || "none",
        "",
        "🟢 Provider Health:",
        formatProviderHealth(),
      ];
      
      await ctx.reply(lines.join("\n"));
    } catch (e: any) {
      console.error("[telega] /telega_ops failed", e?.message || e);
    }
  });

  bot.command("telega_actions", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      const { loadActions, formatActionList } = await import("../providers/creator/action-queue.js");
      
      const actions = role === "owner" ? await loadActions(undefined, "pending", 10) : await loadActions(userId, undefined, 10);
      await ctx.reply(formatActionList(actions));
    } catch (e: any) {
      console.error("[telega-action] /telega_actions failed", e?.message || e);
    }
  });

  bot.command("telega_action_view", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const actionId = args[0];
      
      if (!actionId) {
        await ctx.reply("Usage: /telega_action_view <action_id>");
        return;
      }
      
      const { getAction, formatAction } = await import("../providers/creator/action-queue.js");
const action = await getAction(actionId);
      if (!action) {
        await ctx.reply("Action not found");
        return;
      }
      await ctx.reply(`✅ Action approved!\n\n${formatAction(action)}`);
      
    } catch (e: any) {
      console.error("[telega-action] /telega_action_approve failed", e?.message || e);
    }
  });

  bot.command("telega_action_reject", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const actionId = args[0];
      const reason = args.slice(1).join(" ") || "No reason provided";
      
      if (!actionId) {
        await ctx.reply("Usage: /telega_action_reject <action_id> [reason]");
        return;
      }
      
      const { rejectAction, getAction, formatAction } = await import("../providers/creator/action-queue.js");
      const success = await rejectAction(actionId, userId, reason);
      
      if (!success) {
        await ctx.reply("Cannot reject: action not found or not pending");
        return;
      }
      
      const action = await getAction(actionId);
      if (!action) {
        await ctx.reply("Action not found");
        return;
      }
      await ctx.reply(`❌ Action rejected!\n\n${formatAction(action)}`);
      
    } catch (e: any) {
      console.error("[telega-action] /telega_action_reject failed", e?.message || e);
    }
  });

  bot.hears("▦ Menu", async (ctx) => {
    try {
      console.log("[telegram-menu] menu_open_requested", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
      await showCompactMenu(ctx);
      console.log("[telegram-menu] menu_rendered", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
    } catch (e: any) {
      console.error("[telegram-menu] hears:▦ Menu failed", e?.message || e);
    }
  });

  bot.action("menu:main", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "menu:main" });
      await ctx.answerCbQuery("Menu");
      await showCompactMenu(ctx);
      console.log("[telegram-menu] menu_rendered", { user_id: userIdOf(ctx), role: getTelegramRole(userIdOf(ctx)) });
    } catch (e: any) {
      console.error("[creator-control] menu:main failed", e?.message || e);
    }
  });

  bot.action("menu:collapse", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "menu:collapse" });
      await ctx.answerCbQuery("Collapsed");
      await editOrReply(ctx, "Menu collapsed. Tap ▦ Menu to open.", menuButtonKeyboard());
    } catch (e: any) {
      console.error("[creator-control] menu:collapse failed", e?.message || e);
    }
  });

  // ATLAS - Growth & Distribution
  bot.command("atlas_promote", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const actionId = args[0];
      const channel = args[1] as any || "telegram_channel";
      const name = args.slice(2).join(" ") || "Promotion Campaign";
      
      if (!actionId) {
        await ctx.reply("Usage: /atlas_promote <action_id> [channel] [name]\nChannels: telegram_channel, internal_feed, ad_slot");
        return;
      }
      
      const { getAction } = await import("../providers/creator/action-queue.js");
      const action = await getAction(actionId);
      
      if (!action) {
        await ctx.reply("Action not found. Create an action first.");
        return;
      }
      
      const { createCampaign, formatCampaign } = await import("../providers/creator/growth-layer.js");
      const campaign = await createCampaign(userId, actionId, name, channel);
      
      await ctx.reply(`📢 Campaign created:\n\n${formatCampaign(campaign)}\n\nUse /atlas_start ${campaign.campaign_id} to launch.`);
    } catch (e: any) {
      console.error("[atlas] /atlas_promote failed", e?.message || e);
    }
  });

  bot.command("atlas_status", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      const { loadCampaigns, formatCampaignList } = await import("../providers/creator/growth-layer.js");
      
      const campaigns = role === "owner" ? await loadCampaigns(undefined, "active", 10) : await loadCampaigns(userId, undefined, 10);
      await ctx.reply(formatCampaignList(campaigns));
    } catch (e: any) {
      console.error("[atlas] /atlas_status failed", e?.message || e);
    }
  });

  bot.command("atlas_start", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const campaignId = args[0];
      
      if (!campaignId) {
        await ctx.reply("Usage: /atlas_start <campaign_id>");
        return;
      }
      
      const { startCampaign, formatCampaign } = await import("../providers/creator/growth-layer.js");
      const success = await startCampaign(campaignId, userId);
      
      if (success) {
        await ctx.reply(`🟢 Campaign started!`);
      } else {
        await ctx.reply("Cannot start campaign. Check ownership and status.");
      }
    } catch (e: any) {
      console.error("[atlas] /atlas_start failed", e?.message || e);
    }
  });

  bot.command("atlas_stop", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const campaignId = args[0];
      
      if (!campaignId) {
        await ctx.reply("Usage: /atlas_stop <campaign_id>");
        return;
      }
      
      const { stopCampaign } = await import("../providers/creator/growth-layer.js");
      const success = await stopCampaign(campaignId, userId);
      
      if (success) {
        await ctx.reply(`⏹️ Campaign stopped!`);
      } else {
        await ctx.reply("Cannot stop campaign.");
      }
    } catch (e: any) {
      console.error("[atlas] /atlas_stop failed", e?.message || e);
    }
  });

  // TALENT - Services
  bot.command("talent_create_service", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const actionId = args[0];
      const name = args.slice(1).join(" ") || "My Service";
      
      if (!actionId) {
        await ctx.reply("Usage: /talent_create_service <action_id> [name]");
        return;
      }
      
      const { createService, formatService } = await import("../providers/creator/growth-layer.js");
      const service = await createService(userId, name, "Auto-generated service from action", "general", undefined, "UZS", [actionId]);
      
      await ctx.reply(`🛠️ Service created:\n\n${formatService(service)}`);
    } catch (e: any) {
      console.error("[talent] /talent_create_service failed", e?.message || e);
    }
  });

  bot.command("talent_profile", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const { loadServices, formatServiceList } = await import("../providers/creator/growth-layer.js");
      
      const services = await loadServices(userId, 20);
      await ctx.reply(`👤 Your Services:\n\n${formatServiceList(services)}`);
    } catch (e: any) {
      console.error("[talent] /talent_profile failed", e?.message || e);
    }
  });

  // GROWTH OS - Insights
  bot.command("growth_insight", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const targetId = args[0] || "default";
      const targetType = args[1] as any || "product";
      
      const { generateInsight, generateDropAnalysis, formatInsight } = await import("../providers/creator/growth-layer.js");
      
      const mockMetrics = { impressions: 120, clicks: 15, conversions: 3, previousPeriod: 200 };
      const content = generateDropAnalysis(mockMetrics);
      
      const insight = await generateInsight(userId, "drop_analysis", targetId, targetType as any, content, 0.75);
      
      await ctx.reply(formatInsight(insight));
    } catch (e: any) {
      console.error("[growth] /growth_insight failed", e?.message || e);
    }
  });

  bot.command("growth_ab_test", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const productId = args[0] || "product";
      
      const { generateABTestSuggestion } = await import("../providers/creator/growth-layer.js");
      const suggestion = generateABTestSuggestion(productId);
      
      await ctx.reply(`🧪 A/B Test Suggestion for "${productId}":\n\n` +
        `VERSION A:\nTitle: ${suggestion.titleA}\nDescription: ${suggestion.descriptionA}\n\n` +
        `VERSION B:\nTitle: ${suggestion.titleB}\nDescription: ${suggestion.descriptionB}`);
    } catch (e: any) {
      console.error("[growth] /growth_ab_test failed", e?.message || e);
    }
  });

  bot.command("growth_fix", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const productId = args[0] || "unknown";
      
      await ctx.reply(`💡 Fix suggestions for "${productId}":\n\n` +
        `1. Update product images\n` +
        `2. Refresh title with popular keywords\n` +
        `3. Add more detailed description\n` +
        `4. Review competitor pricing\n` +
        `5. Increase visibility via /atlas_promote`);
    } catch (e: any) {
      console.error("[growth] /growth_fix failed", e?.message || e);
    }
  });

  // MARKETPLACE
  bot.command("market_search", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const query = args.join(" ");
      
      if (!query) {
        await ctx.reply("Usage: /market_search <query>\nExample: /market_search iPhone");
        return;
      }
      
      const { searchListings, formatListingList } = await import("../providers/creator/marketplace.js");
      const results = await searchListings(query, 10);
      await ctx.reply(formatListingList(results));
    } catch (e: any) {
      console.error("[market] /market_search failed", e?.message || e);
    }
  });

  bot.command("market_category", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const category = args[0];
      
      if (!category) {
        const { getCategories } = await import("../providers/creator/marketplace.js");
        await ctx.reply("Categories: " + getCategories().join(", "));
        return;
      }
      
      const { loadListings, formatListingList } = await import("../providers/creator/marketplace.js");
      const results = await loadListings({ category }, 10);
      await ctx.reply(formatListingList(results));
    } catch (e: any) {
      console.error("[market] /market_category failed", e?.message || e);
    }
  });

  bot.command("market_view", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const listingId = args[0];
      
      if (!listingId) {
        await ctx.reply("Usage: /market_view <listing_id>");
        return;
      }
      
      const { getListing, formatListing, loadReviews, formatReview } = await import("../providers/creator/marketplace.js");
      const listing = await getListing(listingId);
      
      if (!listing) {
        await ctx.reply("Listing not found");
        return;
      }
      
      const reviews = await loadReviews(listingId, false);
      let response = formatListing(listing);
      
      if (reviews.length > 0) {
        response += "\n\n� Reviews:\n" + reviews.slice(0, 3).map(r => formatReview(r, false)).join("\n\n");
      }
      
      await ctx.reply(response);
    } catch (e: any) {
      console.error("[market] /market_view failed", e?.message || e);
    }
  });

  bot.command("market_create", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      
      const sepIdx = args.indexOf("|");
      if (sepIdx === -1 || args.length < 3) {
        await ctx.reply("Usage: /market_create <type> <price> | <title> | <description>\nExample: /market_create product 500000 | iPhone 15 | Good phone");
        return;
      }
      
      const type = args[0] as "product" | "service";
      const price = parseInt(args[1]);
      if (isNaN(price)) {
        await ctx.reply("Invalid price");
        return;
      }
      
      const title = args.slice(2, sepIdx).join(" ");
      const description = args.slice(sepIdx + 1).join(" ");
      
      const { createListing, formatListing } = await import("../providers/creator/marketplace.js");
      const listing = await createListing(userId, type, title, description, price, "other", []);
      
      await ctx.reply(`📝 Listing created (pending review):\n\n${formatListing(listing)}`);
    } catch (e: any) {
      console.error("[market] /market_create failed", e?.message || e);
    }
  });

  bot.command("review", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const listingId = args[0];
      const rating = parseInt(args[1]);
      const text = args.slice(2).join(" ");
      
      if (!listingId || isNaN(rating) || rating < 1 || rating > 5) {
        await ctx.reply("Usage: /review <listing_id> <1-5> <text>\nExample: /review lst_12345 5 Great product!");
        return;
      }
      
      const { addReview, getListing } = await import("../providers/creator/marketplace.js");
      const listing = await getListing(listingId);
      
      if (!listing) {
        await ctx.reply("Listing not found");
        return;
      }
      
      const review = await addReview(listingId, userId, rating, text);
      
      if (!review) {
        await ctx.reply("Failed to add review");
        return;
      }
      
      const visibility = review.is_public ? "Public" : "Private (1-3 star)";
      await ctx.reply(`✅ Review added!\nRating: ${rating}⭐\nVisibility: ${visibility}`);
    } catch (e: any) {
      console.error("[market] /review failed", e?.message || e);
    }
  });

  bot.command("order_create", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const listingId = args[0];
      
      if (!listingId) {
        await ctx.reply("Usage: /order_create <listing_id>");
        return;
      }
      
      const { createOrder, formatOrder } = await import("../providers/creator/marketplace.js");
      const order = await createOrder(listingId, userId);
      
      if (!order) {
        await ctx.reply("Cannot create order. Listing may not exist or be inactive, or you are the owner.");
        return;
      }
      
      await ctx.reply(`📋 Order created:\n\n${formatOrder(order)}\n\nSeller will be notified.`);
    } catch (e: any) {
      console.error("[market] /order_create failed", e?.message || e);
    }
  });

  bot.command("order_status", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const orderId = args[0];
      
      if (!orderId) {
        const { loadOrders, formatOrderList } = await import("../providers/creator/marketplace.js");
        const orders = await loadOrders(userId);
        await ctx.reply(formatOrderList(orders));
        return;
      }
      
      const { loadOrders, formatOrder } = await import("../providers/creator/marketplace.js");
      const orders = await loadOrders(userId);
      const order = orders.find(o => o.order_id === orderId);
      
      if (!order) {
        await ctx.reply("Order not found");
        return;
      }
      
      await ctx.reply(formatOrder(order));
    } catch (e: any) {
      console.error("[market] /order_status failed", e?.message || e);
    }
  });

  bot.command("order_accept", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const orderId = args[0];
      
      if (!orderId) {
        await ctx.reply("Usage: /order_accept <order_id>");
        return;
      }
      
      const { updateOrderStatus, loadOrders, formatOrder } = await import("../providers/creator/marketplace.js");
      const success = await updateOrderStatus(orderId, "accepted", userId);
      
      if (success) {
        const orders = await loadOrders(userId);
        const order = orders.find(o => o.order_id === orderId);
        await ctx.reply(`✅ Order accepted!\n\n${formatOrder(order!)}`);
      } else {
        await ctx.reply("Cannot accept order. Check ownership and status.");
      }
    } catch (e: any) {
      console.error("[market] /order_accept failed", e?.message || e);
    }
  });

  bot.command("order_complete", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const orderId = args[0];
      
      if (!orderId) {
        await ctx.reply("Usage: /order_complete <order_id>");
        return;
      }
      
      const { updateOrderStatus, loadOrders, formatOrder } = await import("../providers/creator/marketplace.js");
      const success = await updateOrderStatus(orderId, "completed", userId);
      
      if (success) {
        const orders = await loadOrders(userId);
        const order = orders.find(o => o.order_id === orderId);
        await ctx.reply(`🎉 Order completed!\n\n${formatOrder(order!)}`);
      } else {
        await ctx.reply("Cannot complete order. Check your role and status.");
      }
    } catch (e: any) {
      console.error("[market] /order_complete failed", e?.message || e);
    }
  });

  bot.command("order_chat", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const orderId = args[0];
      const message = args.slice(1).join(" ");
      
      if (!orderId) {
        const { loadOrders, loadDealMessages, formatDealChat } = await import("../providers/creator/marketplace.js");
        const orders = await loadOrders(userId);
        if (orders.length === 0) {
          await ctx.reply("No active orders");
          return;
        }
        const firstOrder = orders[0];
        const msgs = await loadDealMessages(firstOrder.order_id);
        await ctx.reply(`Chat for ${firstOrder.order_id}:\n\n${formatDealChat(msgs, userId)}`);
        return;
      }
      
      if (!message) {
        const { loadDealMessages, formatDealChat } = await import("../providers/creator/marketplace.js");
        const msgs = await loadDealMessages(orderId);
        await ctx.reply(formatDealChat(msgs, userId));
        return;
      }
      
      const { sendDealMessage, formatDealChat, loadDealMessages } = await import("../providers/creator/marketplace.js");
      await sendDealMessage(orderId, userId, message);
      const msgs = await loadDealMessages(orderId);
      await ctx.reply(formatDealChat(msgs, userId));
    } catch (e: any) {
      console.error("[market] /order_chat failed", e?.message || e);
    }
  });

  // WALLET - Payments
  bot.command("wallet", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const { getOrCreateWallet, formatWallet } = await import("../providers/creator/wallet.js");
      
      const wallet = await getOrCreateWallet(userId);
      await ctx.reply(formatWallet(wallet));
    } catch (e: any) {
      console.error("[wallet] /wallet failed", e?.message || e);
    }
  });

  bot.command("wallet_history", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const { loadTransactions, formatTransactionList } = await import("../providers/creator/wallet.js");
      
      const txs = await loadTransactions(userId, 15);
      await ctx.reply(formatTransactionList(txs));
    } catch (e: any) {
      console.error("[wallet] /wallet_history failed", e?.message || e);
    }
  });

  bot.command("pay", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const orderId = args[0];
      
      if (!orderId) {
        await ctx.reply("Usage: /pay <order_id>\nHold funds for the order");
        return;
      }
      
      const { loadOrders } = await import("../providers/creator/marketplace.js");
      const { getOrCreateWallet, holdFunds, formatWallet } = await import("../providers/creator/wallet.js");
      
      const orders = await loadOrders(userId, "buyer");
      const order = orders.find(o => o.order_id === orderId);
      
      if (!order) {
        await ctx.reply("Order not found or you're not the buyer");
        return;
      }
      
      if (order.status !== "accepted") {
        await ctx.reply(`Order status is ${order.status}. Must be accepted first.`);
        return;
      }
      
      const wallet = await getOrCreateWallet(userId);
      const result = await holdFunds(userId, order.price, orderId);
      
      if (!result.success) {
        await ctx.reply(`❌ Payment failed: ${result.reason}\n\n${formatWallet(wallet)}`);
        return;
      }
      
      await ctx.reply(`✅ Payment held!\n\nAmount: ${order.price} ${order.currency}\nOrder: ${orderId}\n\nFunds locked until delivery.`);
    } catch (e: any) {
      console.error("[wallet] /pay failed", e?.message || e);
    }
  });

  bot.command("refund", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const orderId = args[0];
      
      if (!orderId) {
        await ctx.reply("Usage: /refund <order_id>");
        return;
      }
      
      if (role !== "owner") {
        await ctx.reply("Owner only for refunds");
        return;
      }
      
      const { loadOrders } = await import("../providers/creator/marketplace.js");
      const { refundToBuyer } = await import("../providers/creator/wallet.js");
      
      const orders = await loadOrders(userId);
      const order = orders.find(o => o.order_id === orderId);
      
      if (!order) {
        await ctx.reply("Order not found");
        return;
      }
      
      const success = await refundToBuyer(order.buyer_id, order.price, orderId);
      
      if (success) {
        await ctx.reply(`✅ Refunded ${order.price} ${order.currency} to buyer`);
      } else {
        await ctx.reply("Refund failed");
      }
    } catch (e: any) {
      console.error("[wallet] /refund failed", e?.message || e);
    }
  });

  bot.command("add_teleton", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const amount = parseInt(args[0]);
      const targetUserId = args[1] || userId;
      
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("Usage: /add_teleton <amount> [user_id]");
        return;
      }
      
      const { purchaseTeleton, getOrCreateWallet, formatWallet } = await import("../providers/creator/wallet.js");
      await purchaseTeleton(targetUserId, amount, "admin");
      
      const wallet = await getOrCreateWallet(targetUserId);
      await ctx.reply(`✅ Added ${amount} TN to user ${targetUserId}\n\n${formatWallet(wallet)}`);
    } catch (e: any) {
      console.error("[wallet] /add_teleton failed", e?.message || e);
    }
  });

  // ADS - Autonomous Marketing Department
  bot.command("ads_create", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const listingId = args[0];
      const budget = parseInt(args[1]) || 1000;
      const name = args.slice(2).join(" ") || "Ad Campaign";
      
      if (!listingId) {
        await ctx.reply("Usage: /ads_create <listing_id> [budget] [name]\nExample: /ads_create lst_12345 5000 Summer Sale");
        return;
      }
      
      const { getListing } = await import("../providers/creator/marketplace.js");
      const listing = await getListing(listingId);
      
      if (!listing) {
        await ctx.reply("Listing not found");
        return;
      }
      
      const { createCampaign, formatCampaign } = await import("../providers/creator/ads-department.js");
      const campaign = await createCampaign(userId, listingId, name, budget, ["telegram_channel", "internal_feed"]);
      
      await ctx.reply(`📢 Campaign created:\n\n${formatCampaign(campaign)}\n\nUse /ads_start ${campaign.campaign_id} to launch.`);
    } catch (e: any) {
      console.error("[ads] /ads_create failed", e?.message || e);
    }
  });

  bot.command("ads_start", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const campaignId = args[0];
      
      if (!campaignId) {
        await ctx.reply("Usage: /ads_start <campaign_id>");
        return;
      }
      
      const { startCampaign, formatCampaign } = await import("../providers/creator/ads-department.js");
      const success = await startCampaign(campaignId, userId);
      
      if (success) {
        await ctx.reply(`🟢 Campaign started!\n\nBudget reserved and creatives active.`);
      } else {
        await ctx.reply("Cannot start. Check funds and campaign status.");
      }
    } catch (e: any) {
      console.error("[ads] /ads_start failed", e?.message || e);
    }
  });

  bot.command("ads_pause", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const campaignId = args[0];
      
      if (!campaignId) {
        await ctx.reply("Usage: /ads_pause <campaign_id>");
        return;
      }
      
      const { pauseCampaign } = await import("../providers/creator/ads-department.js");
      const success = await pauseCampaign(campaignId, userId);
      
      if (success) {
        await ctx.reply(`⏸️ Campaign paused`);
      } else {
        await ctx.reply("Cannot pause. Check ownership.");
      }
    } catch (e: any) {
      console.error("[ads] /ads_pause failed", e?.message || e);
    }
  });

  bot.command("ads_status", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      
      if (args.length > 0) {
        const campaignId = args[0];
        const { getCampaign, formatCampaign } = await import("../providers/creator/ads-department.js");
        const campaign = await getCampaign(campaignId);
        
        if (!campaign) {
          await ctx.reply("Campaign not found");
          return;
        }
        
        await ctx.reply(formatCampaign(campaign));
      } else {
        const { loadCampaigns, formatCampaignList } = await import("../providers/creator/ads-department.js");
        const campaigns = role === "owner" ? await loadCampaigns(undefined, "active", 10) : await loadCampaigns(userId, undefined, 10);
        await ctx.reply(formatCampaignList(campaigns));
      }
    } catch (e: any) {
      console.error("[ads] /ads_status failed", e?.message || e);
    }
  });

  bot.command("ads_report", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const campaignId = args[0];
      
      if (!campaignId) {
        await ctx.reply("Usage: /ads_report <campaign_id>");
        return;
      }
      
      const { getCampaign, loadCreatives, formatCampaign, formatCreative, optimizeCampaign } = await import("../providers/creator/ads-department.js");
      const campaign = await getCampaign(campaignId);
      
      if (!campaign) {
        await ctx.reply("Campaign not found");
        return;
      }
      
      const creatives = await loadCreatives(campaignId);
      
      let response = formatCampaign(campaign) + "\n\n🎨 Creatives:\n";
      for (const c of creatives.slice(0, 3)) {
        response += "\n" + formatCreative(c) + "\n";
      }
      
      const opt = await optimizeCampaign(campaignId);
      response += `\n\n🔧 Optimization: ${opt.action} - ${opt.reason}`;
      
      await ctx.reply(response);
    } catch (e: any) {
      console.error("[ads] /ads_report failed", e?.message || e);
    }
  });

  bot.command("ads_optimize", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const campaignId = args[0];
      
      if (!campaignId) {
        await ctx.reply("Usage: /ads_optimize <campaign_id>");
        return;
      }
      
      const { optimizeCampaign } = await import("../providers/creator/ads-department.js");
      const result = await optimizeCampaign(campaignId);
      
      await ctx.reply(`🔧 Optimization result:\n\nAction: ${result.action}\nReason: ${result.reason}`);
    } catch (e: any) {
      console.error("[ads] /ads_optimize failed", e?.message || e);
    }
  });

  // GLOBAL - Multi-currency and Regions
  bot.command("set_country", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const countryCode = args[0]?.toUpperCase();
      
      if (!countryCode) {
        const globalExp = await import("../providers/creator/global-expansion.js");
        const getUserLocale = globalExp.getUserLocale;
        const formatUserLocale = globalExp.formatUserLocale;
        const locale = await getUserLocale(userId);
        await ctx.reply(formatUserLocale(locale));
        return;
      }
      
      const globalExp = await import("../providers/creator/global-expansion.js");
      const setUserLocale = globalExp.setUserLocale;
      const getRegion = globalExp.getRegion;
      const formatUserLocale = globalExp.formatUserLocale;
      const suggestRegion = globalExp.suggestRegion;
      
      const region = await getRegion(countryCode);
      if (!region) {
        const suggested = suggestRegion(undefined, countryCode);
        await ctx.reply(`Region ${countryCode} not found. Try: UZ, RU, KZ, EU, US`);
        return;
      }
      
      const locale = await setUserLocale(userId, countryCode, region.language_default, region.currency_default);
      await ctx.reply(formatUserLocale(locale));
    } catch (e: any) {
      console.error("[global] /set_country failed", e?.message || e);
    }
  });

bot.command("set_currency", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const currencyCode = args[0]?.toUpperCase();
      
      if (!currencyCode) {
        await ctx.reply("Usage: /set_currency <code>\nExample: /set_currency USD");
        return;
      }
      
      const globalExp = await import("../providers/creator/global-expansion.js");
      const setUserLocale = globalExp.setUserLocale;
      const getCurrency = globalExp.getCurrency;
      const formatUserLocale = globalExp.formatUserLocale;
      const loadCurrencies = globalExp.loadCurrencies;
      
      const currency = await getCurrency(currencyCode);
      if (!currency) {
        const currencies = await loadCurrencies();
        await ctx.reply(`Currency not found. Available: ${currencies.map(c => c.code).join(", ")}`);
        return;
      }
      
      const locale = await setUserLocale(userId, undefined, undefined, currencyCode as any);
      await ctx.reply(formatUserLocale(locale));
    } catch (e: any) {
      console.error("[global] /set_currency failed", e?.message || e);
    }
  });

  bot.command("rates", async (ctx) => {
    try {
      const { loadCurrencies, formatRatesList } = await import("../providers/creator/global-expansion.js");
      const currencies = await loadCurrencies();
      await ctx.reply(formatRatesList(currencies));
    } catch (e: any) {
      console.error("[global] /rates failed", e?.message || e);
    }
  });

  bot.command("regions", async (ctx) => {
    try {
      const { getActiveRegions, formatRegionList } = await import("../providers/creator/global-expansion.js");
      const regions = await getActiveRegions();
      await ctx.reply(formatRegionList(regions));
    } catch (e: any) {
      console.error("[global] /regions failed", e?.message || e);
    }
  });

  bot.command("locale", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const { getUserLocale, formatUserLocale, getRegion, formatPriceWithConversion, convertTeletonToLocal } = await import("../providers/creator/global-expansion.js");
      const { getOrCreateWallet } = await import("../providers/creator/wallet.js");
      
      const locale = await getUserLocale(userId);
      const wallet = await getOrCreateWallet(userId);
      const region = await getRegion(locale.country);
      
      const converted = await convertTeletonToLocal(wallet.teleton_balance, locale.currency);
      
      let response = formatUserLocale(locale);
      response += `\n\n💰 Your balance: ${converted.toLocaleString()} ${locale.currency}`;
      
      if (region) {
        response += `\n\n🌍 Payment methods: ${region.payment_providers.join(", ")}`;
      }
      
      await ctx.reply(response);
    } catch (e: any) {
      console.error("[global] /locale failed", e?.message || e);
    }
  });

  bot.command("convert", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const amount = parseFloat(args[0]);
      const fromCode = args[1]?.toUpperCase() as any;
      const toCode = args[2]?.toUpperCase() as any;
      
      if (isNaN(amount) || !fromCode || !toCode) {
        await ctx.reply("Usage: /convert <amount> <from> <to>\nExample: /convert 100 TNT UZS");
        return;
      }
      
      const { convertCurrency } = await import("../providers/creator/global-expansion.js");
      const result = await convertCurrency(amount, fromCode, toCode);
      
      await ctx.reply(`${amount} ${fromCode} = ${result.amount} ${toCode}\nRate: ${result.rate.toFixed(4)}`);
    } catch (e: any) {
      console.error("[global] /convert failed", e?.message || e);
    }
  });

  // CREATOR ECONOMY - v20
  bot.command("referral_code", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const { createReferralCode } = await import("../providers/creator/creator-economy.js");
      const code = await createReferralCode(userId);
      await ctx.reply(`🎯 Your referral code: ${code}\n\nShare: telega.app/invite?ref=${code}`);
    } catch (e: any) {
      console.error("[economy] /referral_code failed", e?.message || e);
    }
  });

  bot.command("referral_stats", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const { getReferralStats, formatReferralStats } = await import("../providers/creator/creator-economy.js");
      const stats = await getReferralStats(userId);
      await ctx.reply(formatReferralStats(stats));
    } catch (e: any) {
      console.error("[economy] /referral_stats failed", e?.message || e);
    }
  });

  bot.command("invite", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const newUserId = args[0];
      
      if (!newUserId) {
        await ctx.reply("Usage: /invite <new_user_id>\nExample: /invite 123456789");
        return;
      }
      
      const { registerReferral } = await import("../providers/creator/creator-economy.js");
      const result = await registerReferral("REFDEFAULT", newUserId);
      
      if (result.success) {
        await ctx.reply(`✅ Referral registered! Both you and the new user get ${result.reward} TN bonus.`);
      } else {
        await ctx.reply(`❌ Failed: ${result.reason}`);
      }
    } catch (e: any) {
      console.error("[economy] /invite failed", e?.message || e);
    }
  });

  bot.command("creator_profile", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      
      if (args.length > 0) {
        const bio = args.join(" ");
        const { updateCreatorProfile, getCreatorProfile, formatCreatorProfile } = await import("../providers/creator/creator-economy.js");
        await updateCreatorProfile(userId, { bio, updated_at: Date.now() });
        const profile = await getCreatorProfile(userId);
        await ctx.reply(formatCreatorProfile(profile!));
      } else {
        const { getCreatorProfile, formatCreatorProfile, createReferralCode } = await import("../providers/creator/creator-economy.js");
        let profile = await getCreatorProfile(userId);
        if (!profile) {
          await createReferralCode(userId);
          profile = await getCreatorProfile(userId);
        }
        await ctx.reply(formatCreatorProfile(profile!));
      }
    } catch (e: any) {
      console.error("[economy] /creator_profile failed", e?.message || e);
    }
  });

  bot.command("creator_stats", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const { getCreatorProfile, formatCreatorProfile } = await import("../providers/creator/creator-economy.js");
      const profile = await getCreatorProfile(userId);
      
      if (!profile) {
        await ctx.reply("No creator profile yet. Use /creator_profile to create one.");
        return;
      }
      
      let response = formatCreatorProfile(profile);
      
      const { getReferralStats, formatReferralStats } = await import("../providers/creator/creator-economy.js");
      const stats = await getReferralStats(userId);
      response += "\n\n" + formatReferralStats(stats);
      
      await ctx.reply(response);
    } catch (e: any) {
      console.error("[economy] /creator_stats failed", e?.message || e);
    }
  });

  bot.command("leaderboard", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const type = (args[0] === "creators" || args[0] === "sellers" || args[0] === "affiliates") 
        ? args[0].replace("s", "") as "creator" | "seller" | "affiliate"
        : undefined;
      
      const { getLeaderboard, formatLeaderboard } = await import("../providers/creator/creator-economy.js");
      const profiles = await getLeaderboard(type, 10);
      await ctx.reply(formatLeaderboard(profiles));
    } catch (e: any) {
      console.error("[economy] /leaderboard failed", e?.message || e);
    }
  });

  bot.command("partner", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const rate = parseFloat(args[0]) || 0.1;
      
      if (rate < 0.05 || rate > 0.3) {
        await ctx.reply("Commission rate must be between 5% and 30% (0.05-0.3)");
        return;
      }
      
      const { createPartner } = await import("../providers/creator/creator-economy.js");
      const partner = await createPartner(userId, rate);
      
      await ctx.reply(`✅ Partner account created!\n\nCommission rate: ${rate * 100}%\nEarnings: ${partner.earnings_teleton} TN`);
    } catch (e: any) {
      console.error("[economy] /partner failed", e?.message || e);
    }
  });

  bot.action("menu:chat", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "menu:chat" });
      await ctx.answerCbQuery("Chat");
      await editOrReply(ctx, "Chat mode. Send a message.", menuButtonKeyboard());
    } catch (e: any) {
      console.error("[creator-control] menu:chat failed", e?.message || e);
    }
  });

  bot.action("menu:help", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "menu:help" });
      await ctx.answerCbQuery("Help");
      await editOrReply(ctx, "Help: use /start, open ▦ Menu, choose Providers, then send a message.", menuButtonKeyboard());
    } catch (e: any) {
      console.error("[creator-control] menu:help failed", e?.message || e);
    }
  });

  // PAYOUT SYSTEM - v20.1
  bot.command("withdraw", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const amount = parseFloat(args[0]);
      const method = (args[1] || "click") as any;
      const details = args.slice(2).join(" ") || "N/A";
      
      if (isNaN(amount) || amount < 100) {
        await ctx.reply("Usage: /withdraw <amount_tn> [method] [details]\nMinimum: 100 TN\nMethods: click, payme, stripe, yoomoney, bank");
        return;
      }
      
      const { createPayoutRequest, formatPayout } = await import("../providers/creator/payout-system.js");
      const { getUserLocale } = await import("../providers/creator/global-expansion.js");
      const locale = await getUserLocale(userId);
      
      const result = await createPayoutRequest(userId, amount, method, details, locale.currency);
      
      if (!result.success) {
        await ctx.reply(`❌ Withdrawal failed: ${result.reason}`);
        return;
      }
      
      await ctx.reply(`⏳ Withdrawal request created!\n\n${formatPayout(result.payout!)}\n\nOwner will review your request.`);
    } catch (e: any) {
      console.error("[payout] /withdraw failed", e?.message || e);
    }
  });

  bot.command("withdraw_status", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      
      if (args.length > 0) {
        const payoutId = args[0];
        const { getPayout, formatPayout } = await import("../providers/creator/payout-system.js");
        const payout = await getPayout(payoutId);
        
        if (!payout || payout.user_id !== userId) {
          await ctx.reply("Payout not found");
          return;
        }
        
        await ctx.reply(formatPayout(payout));
      } else {
        const { loadPayouts, formatPayoutList } = await import("../providers/creator/payout-system.js");
        const payouts = await loadPayouts(userId);
        await ctx.reply(formatPayoutList(payouts));
      }
    } catch (e: any) {
      console.error("[payout] /withdraw_status failed", e?.message || e);
    }
  });

  bot.command("withdraw_history", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const { loadPayouts, formatPayoutList } = await import("../providers/creator/payout-system.js");
      const payouts = await loadPayouts(userId);
      await ctx.reply(formatPayoutList(payouts));
    } catch (e: any) {
      console.error("[payout] /withdraw_history failed", e?.message || e);
    }
  });

  bot.command("approve_withdraw", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const payoutId = args[0];
      
      if (!payoutId) {
        await ctx.reply("Usage: /approve_withdraw <payout_id>");
        return;
      }
      
      const { approvePayout, formatPayout, getPayout } = await import("../providers/creator/payout-system.js");
      const result = await approvePayout(payoutId, userId);
      
      if (result.success) {
        const payout = await getPayout(payoutId);
        await ctx.reply(`✅ Payout approved! Processing...\n\n${formatPayout(payout!)}`);
      } else {
        await ctx.reply(`❌ Failed: ${result.reason}`);
      }
    } catch (e: any) {
      console.error("[payout] /approve_withdraw failed", e?.message || e);
    }
  });

  bot.command("process_withdraw", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const payoutId = args[0];
      
      if (!payoutId) {
        await ctx.reply("Usage: /process_withdraw <payout_id>");
        return;
      }
      
      const { processPayout, formatPayout, getPayout } = await import("../providers/creator/payout-system.js");
      const payout = await getPayout(payoutId);
      
      if (!payout || payout.user_id !== userId) {
        await ctx.reply("Payout not found or not yours");
        return;
      }
      
      const result = await processPayout(payoutId);
      
      if (result.success) {
        const payout = await getPayout(payoutId);
        await ctx.reply(`🎉 Payout completed!\n\n${formatPayout(payout!)}`);
      } else {
        await ctx.reply(`❌ Failed: ${result.reason}`);
      }
    } catch (e: any) {
      console.error("[payout] /process_withdraw failed", e?.message || e);
    }
  });

  bot.command("reject_withdraw", async (ctx) => {
    try {
      const userId = String(userIdOf(ctx));
      const role = getTelegramRole(userId);
      
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }
      
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const payoutId = args[0];
      const reason = args.slice(1).join(" ") || "No reason provided";
      
      if (!payoutId) {
        await ctx.reply("Usage: /reject_withdraw <payout_id> [reason]");
        return;
      }
      
      const { rejectPayout, formatPayout, getPayout } = await import("../providers/creator/payout-system.js");
      const result = await rejectPayout(payoutId, userId, reason);
      
      if (result.success) {
        const payout = await getPayout(payoutId);
        await ctx.reply(`❌ Payout rejected!\n\n${formatPayout(payout!)}`);
      } else {
        await ctx.reply(`❌ Failed: ${result.reason}`);
      }
    } catch (e: any) {
      console.error("[payout] /reject_withdraw failed", e?.message || e);
    }
  });

  bot.action("menu:settings", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "menu:settings" });
      await ctx.answerCbQuery("Settings");
      const settings = settingsOf(ctx);
      await editOrReply(
        ctx,
        `Settings\nProvider: ${providerLabel(settings.provider)}\nBridge: ${settings.bridgeEnabled ? "ON" : "OFF"}\nCreator Mode: ${settings.creatorMode ? "ON" : "OFF"}`,
        Markup.inlineKeyboard([[Markup.button.callback("⬅️ Back", "menu:main")]])
      );
    } catch (e: any) {
      console.error("[creator-control] menu:settings failed", e?.message || e);
    }
  });

  bot.action("menu:providers", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "menu:providers" });
      await ctx.answerCbQuery("Providers");
      const role = getTelegramRole(userIdOf(ctx));
      const settings = settingsOf(ctx);
      const mode = role === "public" ? "view only" : "select provider";
      await editOrReply(
        ctx,
        `Providers (${mode})\nCurrent: ${providerLabel(settings.provider)}`,
        providerKeyboard(ctx)
      );
    } catch (e: any) {
      console.error("[creator-control] menu:providers failed", e?.message || e);
    }
  });

  bot.action("provider:view", async (ctx) => {
    try {
      await ctx.answerCbQuery("Provider switching is limited", { show_alert: true });
    } catch (e: any) {
      console.error("[creator-control] provider:view failed", e?.message || e);
    }
  });

  bot.action(/^provider:set:(auto|openai_web|qwen_web|deepseek_web|kimi_web|ollama_local)$/i, async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "provider:set" });
      const role = getTelegramRole(userIdOf(ctx));
      if (role === "public") {
        await ctx.answerCbQuery("Not allowed", { show_alert: true });
        return;
      }
      const provider = String((ctx as any)?.match?.[1] || "auto") as TelegramProvider;
      const settings = settingsOf(ctx);
      settings.provider = provider;
      settings.model = providerToModel(provider);
      const bridgeProvider = provider.endsWith("_web");
      settings.bridgeEnabled = bridgeProvider;
      settings.creatorMode = bridgeProvider;
      userRuntimeSettings.set(userIdOf(ctx), settings);
      console.log("[creator-control] provider selected", {
        user_id: userIdOf(ctx),
        role,
        provider,
        model: settings.model,
      });
      console.log("[telegram-menu] provider_selected", { user_id: userIdOf(ctx), provider });
      await ctx.answerCbQuery(`Provider: ${providerLabel(provider)}`);
      await editOrReply(
        ctx,
        `Providers\nCurrent: ${providerLabel(provider)}\nModel: ${settings.model}`,
        providerKeyboard(ctx)
      );
    } catch (e: any) {
      console.error("[creator-control] provider:set failed", e?.message || e);
     }
  });

  // ANALYTICS - v22 BI Layer
  bot.command("analytics", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const date = args[0]; // YYYY-MM-DD format
      
      const { computeDailyAnalytics, formatAnalyticsAggregate } = await import("../providers/creator/analytics-bi.js");
      const aggregate = await computeDailyAnalytics(date);
      
      await ctx.reply(formatAnalyticsAggregate(aggregate));
    } catch (e: any) {
      console.error("[analytics] /analytics failed", e?.message || e);
    }
  });

  bot.command("analytics_insights", async (ctx) => {
    try {
      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const metric = args[0]; // revenue_total, orders_count, etc.
      
      const { getInsights, formatInsightsList } = await import("../providers/creator/analytics-bi.js");
      const insights = await getInsights(metric);
      
      await ctx.reply(formatInsightsList(insights));
    } catch (e: any) {
      console.error("[analytics] /analytics_insights failed", e?.message || e);
    }
  });

  bot.command("analytics_revenue", async (ctx) => {
    try {
      const { loadAggregates, formatAnalyticsAggregate } = await import("../providers/creator/analytics-bi.js");
      const aggregates = await loadAggregates(7);
      
      if (aggregates.length === 0) {
        await ctx.reply("No analytics data yet");
        return;
      }
      
      const totalRevenue = aggregates.reduce((sum, a) => sum + a.revenue_total, 0);
      const totalOrders = aggregates.reduce((sum, a) => sum + a.orders_count, 0);
      const avgRoi = aggregates.reduce((sum, a) => sum + a.roi, 0) / aggregates.length;
      
      const lines = [
        "📊 Revenue Analytics (7 days):",
        "",
        `Total Revenue: ${totalRevenue.toLocaleString()} TN`,
        `Total Orders: ${totalOrders}`,
        `Avg ROI: ${avgRoi.toFixed(1)}%`,
        "",
        "Daily breakdown:",
      ];
      
      for (const a of aggregates.slice(0, 5)) {
        lines.push(`${a.date}: ${a.revenue_total.toLocaleString()} TN (${a.orders_count} orders)`);
      }
      
      await ctx.reply(lines.join("\n"));
    } catch (e: any) {
      console.error("[analytics] /analytics_revenue failed", e?.message || e);
    }
  });

  bot.command("analytics_ads", async (ctx) => {
    try {
      const { loadAggregates, formatAnalyticsAggregate } = await import("../providers/creator/analytics-bi.js");
      const aggregates = await loadAggregates(7);
      
      if (aggregates.length === 0) {
        await ctx.reply("No analytics data yet");
        return;
      }
      
      const totalSpend = aggregates.reduce((sum, a) => sum + a.ads_spend, 0);
      const totalAdsRevenue = aggregates.reduce((sum, a) => sum + a.ads_revenue, 0);
      const avgRoi = aggregates.reduce((sum, a) => sum + a.roi, 0) / aggregates.length;
      
      const lines = [
        "📢 Ads Analytics (7 days):",
        "",
        `Total Spend: ${totalSpend.toLocaleString()} TN`,
        `Ads Revenue: ${totalAdsRevenue.toLocaleString()} TN`,
        `Avg ROI: ${avgRoi.toFixed(1)}%`,
        "",
        "Daily breakdown:",
      ];
      
      for (const a of aggregates.slice(0, 5)) {
        lines.push(`${a.date}: spend ${a.ads_spend.toLocaleString()} TN, ROI ${a.roi.toFixed(1)}%`);
      }
      
      await ctx.reply(lines.join("\n"));
    } catch (e: any) {
      console.error("[analytics] /analytics_ads failed", e?.message || e);
    }
  });

  bot.command("analytics_creators", async (ctx) => {
    try {
      const { getTopCreators, formatTopCreators } = await import("../providers/creator/analytics-bi.js");
      const topCreators = await getTopCreators(5);
      
      await ctx.reply(formatTopCreators(topCreators));
    } catch (e: any) {
      console.error("[analytics] /analytics_creators failed", e?.message || e);
    }
  });

  bot.command("analytics_listings", async (ctx) => {
    try {
      const { getTopListings, formatTopListings } = await import("../providers/creator/analytics-bi.js");
      const topListings = await getTopListings(5);
      
      await ctx.reply(formatTopListings(topListings));
    } catch (e: any) {
      console.error("[analytics] /analytics_listings failed", e?.message || e);
    }
  });

  bot.action("menu:bridge", async (ctx) => {
    try {
      console.log("[telegram-menu] callback_received", { user_id: userIdOf(ctx), action: "menu:bridge" });
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.answerCbQuery("Creator Bridge is owner-only", { show_alert: true });
        return;
      }
      const settings = settingsOf(ctx);
      await ctx.answerCbQuery("Creator Bridge");
      await editOrReply(
        ctx,
        `Creator Bridge\nBridge: ${settings.bridgeEnabled ? "ON" : "OFF"}\nCreator Mode: ${settings.creatorMode ? "ON" : "OFF"}\nCurrent provider: ${providerLabel(settings.provider)}`,
        bridgeKeyboard(ctx)
      );
    } catch (e: any) {
      console.error("[creator-control] menu:bridge failed", e?.message || e);
    }
  });

  bot.action("bridge:toggle", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.answerCbQuery("Owner-only", { show_alert: true });
        return;
      }
      const settings = settingsOf(ctx);
      settings.bridgeEnabled = !settings.bridgeEnabled;
      userRuntimeSettings.set(userIdOf(ctx), settings);
      console.log("[creator-control] bridge toggled", {
        user_id: userIdOf(ctx),
        bridgeEnabled: settings.bridgeEnabled,
      });
      await ctx.answerCbQuery(`Bridge ${settings.bridgeEnabled ? "ON" : "OFF"}`);
      await editOrReply(
        ctx,
        `Creator Bridge\nBridge: ${settings.bridgeEnabled ? "ON" : "OFF"}\nCreator Mode: ${settings.creatorMode ? "ON" : "OFF"}\nCurrent provider: ${providerLabel(settings.provider)}`,
        bridgeKeyboard(ctx)
      );
    } catch (e: any) {
      console.error("[creator-control] bridge:toggle failed", e?.message || e);
    }
  });

  bot.action("creator:toggle", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.answerCbQuery("Owner-only", { show_alert: true });
        return;
      }
      const settings = settingsOf(ctx);
      settings.creatorMode = !settings.creatorMode;
      userRuntimeSettings.set(userIdOf(ctx), settings);
      console.log("[creator-control] creator mode toggled", {
        user_id: userIdOf(ctx),
        creatorMode: settings.creatorMode,
      });
      await ctx.answerCbQuery(`Creator Mode ${settings.creatorMode ? "ON" : "OFF"}`);
      await editOrReply(
        ctx,
        `Creator Bridge\nBridge: ${settings.bridgeEnabled ? "ON" : "OFF"}\nCreator Mode: ${settings.creatorMode ? "ON" : "OFF"}\nCurrent provider: ${providerLabel(settings.provider)}`,
        bridgeKeyboard(ctx)
      );
    } catch (e: any) {
      console.error("[creator-control] creator:toggle failed", e?.message || e);
    }
  });

  bot.action("bridge:health", async (ctx) => {
    try {
      const role = getTelegramRole(userIdOf(ctx));
      if (role !== "owner") {
        await ctx.answerCbQuery("Owner-only", { show_alert: true });
        return;
      }
      const settings = settingsOf(ctx);
      const res = await fetch("http://127.0.0.1:8787/ready");
      const ok = res.ok;
      await ctx.answerCbQuery(ok ? "Healthy" : "Unhealthy");
      await editOrReply(
        ctx,
        `Creator Bridge Health\nAPI: ${ok ? "OK" : `HTTP ${res.status}`}\nProvider: ${providerLabel(settings.provider)}\nBridge: ${settings.bridgeEnabled ? "ON" : "OFF"}\nCreator Mode: ${settings.creatorMode ? "ON" : "OFF"}`,
        bridgeKeyboard(ctx)
      );
    } catch (e: any) {
      console.error("[creator-control] bridge:health failed", e?.message || e);
      try {
        await ctx.answerCbQuery("Health check failed", { show_alert: true });
      } catch {}
    }
  });

  bot.command("intel_on", async (ctx) => {
    setIntelEnabled(true);
    await ctx.reply("✅ Intel парсинг: ВКЛ");
  });

  bot.command("intel_off", async (ctx) => {
    setIntelEnabled(false);
    await ctx.reply("🛑 Intel парсинг: ВЫКЛ");
  });

  bot.command("intel_status", async (ctx) => {
    const idx = loadIndex(telegaRoot);
    const inboxFiles = listInboxJsonFiles(telegaRoot);
    await ctx.reply(
      `📊 Intel статус\n` +
        `• включено: ${isIntelEnabled() ? "ДА" : "НЕТ"}\n` +
        `• inbox: ${inboxFiles.length} карточек\n` +
        `• index: ${idx.length} строк`
    );
  });

  bot.command("intel_last", async (ctx) => {
    const inboxFiles = listInboxJsonFiles(telegaRoot);
    if (inboxFiles.length === 0) {
      await ctx.reply("Пока нет карточек в inbox.");
      return;
    }
    const last = readIntelCardFile(telegaRoot, inboxFiles[0]);
    await ctx.reply(
      `🧠 Последний Intel\n` +
        `• ${last.title}\n` +
        `• pack: ${last.proposed_pack}\n` +
        `• conf: ${last.confidence.toFixed(2)}\n` +
        `• сводка:\n- ${last.summary.join("\n- ")}`
    );
  });

  bot.command("digest", async (ctx) => {
    try {
      const result = runDigest({ telegaRoot, takeLastN: 25 });
      await ctx.reply(
        `🧾 Digest создан\n` +
          `• id: ${result.digestId}\n` +
          `• карточек: ${result.totalCards}\n` +
          `• md: ${result.digestMdFile}\n` +
          `• json: ${result.digestJsonFile}\n` +
          `• топ packs:\n- ${result.packCandidates
            .slice(0, 5)
            .map((p) => `${p.pack} (${p.count})`)
            .join("\n- ")}`
      );
    } catch (e: any) {
      await ctx.reply(`❌ Digest ошибка: ${e?.message || String(e)}`);
    }
  });

  bot.command("digest_weekly", async (ctx) => {
    try {
      const result = runDigestWeekly({ telegaRoot, days: 7, takeMax: 300 });
      await ctx.reply(
        `📅 Weekly Digest создан\n` +
          `• id: ${result.digestId}\n` +
          `• карточек: ${result.totalCards}\n` +
          `• md: ${result.digestMdFile}\n` +
          `• json: ${result.digestJsonFile}\n` +
          `• топ packs:\n- ${result.packCandidates
            .slice(0, 5)
            .map((p) => `${p.pack} (${p.count})`)
            .join("\n- ")}`
      );
    } catch (e: any) {
      await ctx.reply(`❌ digest_weekly ошибка: ${e?.message || String(e)}`);
    }
  });

  bot.command("build_from_last_digest", async (ctx) => {
    try {
      const d = runDigestWeekly({ telegaRoot, days: 7, takeMax: 300 });
      const top = (d.packCandidates || []).slice(0, 3);
      if (top.length === 0) {
        await ctx.reply("Нет pack candidates для BuildTask.");
        return;
      }

      const created: string[] = [];
      for (const p of top) {
        const r = writeBuildTaskFromPackCandidate({
          telegaRoot,
          digestId: d.digestId,
          pack: p.pack,
          evidence: { notes: ["auto-generated from weekly digest (pantheon)"] },
        });
        created.push(`${p.pack} → ${r.file}`);
      }

      await ctx.reply(
        `🛠 BuildTasks созданы (Tele•Core Contract)\n` +
          `• digest: ${d.digestId}\n` +
          created.map((s) => `- ${s}`).join("\n")
      );
    } catch (e: any) {
      await ctx.reply(`❌ build_from_last_digest ошибка: ${e?.message || String(e)}`);
    }
  });

  bot.command("build", async (ctx) => {
    try {
      const raw = String((ctx as any)?.message?.text || "").trim();
      const parts = raw.split(/\s+/g).filter(Boolean);
      const pack = parts.slice(1).join(" ").trim();

      if (!pack) {
        await ctx.reply("Формат: /build <pack>\nПример: /build Guardian");
        return;
      }

      const r = writeManualBuildTask({
        telegaRoot,
        pack,
        evidence: { notes: [`manual request by ${String((ctx as any)?.from?.id || "")}`] },
      });

      await ctx.reply(
        `🛠 BuildTask поставлен в очередь\n` +
          `• pack: ${pack}\n` +
          `• task: ${r.file}\n` +
          `• статус: queued (outbox)\n` +
          `• hint: ${r.digestId}`
      );
    } catch (e: any) {
      await ctx.reply(`❌ /build ошибка: ${e?.message || String(e)}`);
    }
  });

  bot.command("build_status", async (ctx) => {
    try {
      const counts = countBuildTasks(telegaRoot);
      const lastOutbox = listBuildTasks(telegaRoot, "outbox", 5);
      const lastDone = listBuildTasks(telegaRoot, "done", 5);
      const lastFailed = listBuildTasks(telegaRoot, "failed", 5);

      const fmt = (box: "outbox" | "done" | "failed", files: string[]) => {
        if (files.length === 0) return ["- (empty)"];
        return files.map((f) => {
          const t = readBuildTask(telegaRoot, box, f);
          const when = t.created_at?.slice(11, 19) || "??:??:??";
          return `- ${when} • ${t.intent.pack} • ${t.status} • ${t.id}`;
        });
      };

      await ctx.reply(
        `📦 Статус очереди BuildTask\n` +
          `• outbox(queued): ${counts.outbox}\n` +
          `• inbox(results): ${counts.inbox}\n` +
          `• done: ${counts.done}\n` +
          `• failed: ${counts.failed}\n\n` +
        `🟡 Последние outbox:\n${fmt("outbox", lastOutbox).join("\n")}\n\n` +
          `🟢 Последние done:\n${fmt("done", lastDone).join("\n")}\n\n` +
          `🔴 Последние failed:\n${fmt("failed", lastFailed).join("\n")}`
      );
    } catch (e: any) {
      await ctx.reply(`❌ /build_status ошибка: ${e?.message || String(e)}`);
    }
  });

  bot.command("build_run_one", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";

      if (!isMaker(uid, priv)) {
        await ctx.reply(`⛔ ${MSG.makerOnly} Запусти в личке или добавь свой id в PANTHEON_MAKER_IDS.`);
        return;
      }

      const r = runOneBuildTask({ telegaRoot });

      if (r.kind === "EMPTY") {
        await ctx.reply("🟦 outbox пуст. Нечего исполнять.");
        return;
      }

      if (r.kind === "DONE") {
        await ctx.reply(
          `✅ BuildTask выполнен\n` +
            `• task: ${r.taskId}\n` +
          `• файл задачи: ${r.taskFile} (перемещён в done)\n` +
            `• результат: ${r.resultFile} (inbox)\n` +
            `• примечание: артефакт записан в mission-control/buildtasks/artifacts/`
        );
        return;
      }

      await ctx.reply(
        `❌ BuildTask ошибка\n` +
          `• task: ${r.taskId}\n` +
          `• файл задачи: ${r.taskFile} (перемещён в failed)\n` +
          `• результат: ${r.resultFile} (inbox)\n` +
          `• ошибка: ${r.error}`
      );
    } catch (e: any) {
      await ctx.reply(`❌ /build_run_one ошибка: ${e?.message || String(e)}`);
    }
  });

  bot.command("build_last_result", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";

      if (!isMaker(uid, priv)) {
        await ctx.reply(`⛔ ${MSG.makerOnly}`);
        return;
      }

      const inboxDir = path.join(telegaRoot, "mission-control", "buildtasks", "inbox");
      if (!fs.existsSync(inboxDir)) {
        await ctx.reply("inbox отсутствует.");
        return;
      }

      const files = fs.readdirSync(inboxDir).filter((f) => f.endsWith(".json")).sort().reverse();
      if (files.length === 0) {
        await ctx.reply("inbox пуст — нет BuildResult.");
        return;
      }

      const lastFile = files[0];
      const raw = fs.readFileSync(path.join(inboxDir, lastFile), "utf8");
      const res = JSON.parse(raw);

      const status = res?.status || "unknown";
      const sum = Array.isArray(res?.summary) ? res.summary.slice(0, 5) : [];
      const arts = Array.isArray(res?.artifacts) ? res.artifacts.slice(0, 3) : [];

      await ctx.reply(
        `📮 Последний BuildResult\n` +
          `• файл: ${lastFile}\n` +
          `• статус: ${status}\n` +
          (sum.length ? `• сводка:\n- ${sum.join("\n- ")}` : "") +
          (arts.length ? `\n• артефакты:\n- ${arts.map((a: any) => a.path).join("\n- ")}` : "")
      );
    } catch (e: any) {
      await ctx.reply(`❌ /build_last_result ошибка: ${e?.message || String(e)}`);
    }
  });

  bot.command("build_result", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";

      if (!isMaker(uid, priv)) {
        await ctx.reply(`⛔ ${MSG.makerOnly}`);
        return;
      }

      const raw = String((ctx as any)?.message?.text || "").trim();
      const parts = raw.split(/\s+/g).filter(Boolean);
      const brId = String(parts[1] || "").trim();

      if (!brId) {
        await ctx.reply(
          "Формат: /build_result <br_id>\nПример: /build_result br_2026-01-30_ab12cd34ef56"
        );
        return;
      }

      const inboxDir = path.join(telegaRoot, "mission-control", "buildtasks", "inbox");
      const file = brId.endsWith(".json") ? brId : `${brId}.json`;
      const abs = path.join(inboxDir, file);

      if (!fs.existsSync(abs)) {
        await ctx.reply(`❌ BuildResult не найден: inbox/${file}`);
        return;
      }

      const res = JSON.parse(fs.readFileSync(abs, "utf8"));

      const status = String(res?.status || "unknown");
      const taskId = String(res?.task_id || "");
      const created = String(res?.created_at || "");
      const summary: string[] = Array.isArray(res?.summary) ? res.summary : [];
      const artifacts: any[] = Array.isArray(res?.artifacts) ? res.artifacts : [];
      const logs: string[] =
        Array.isArray(res?.logs?.lines) ? res.logs.lines : Array.isArray(res?.logs) ? res.logs : [];

      const errMsg = String(res?.error?.message || "");
      const errLine = errMsg ? `• error: ${errMsg}\n` : "";

      const artsLines =
        artifacts.length === 0
          ? ["- (none)"]
          : artifacts
              .slice(0, 10)
              .map((a: any) => `- ${a.type || "file"} • ${a.path}${a.note ? ` — ${a.note}` : ""}`);

      const logLines =
        logs.length === 0 ? ["- (no logs)"] : logs.slice(0, 20).map((l) => `- ${String(l)}`);

      await ctx.reply(
        `📦 BuildResult\n` +
          `• id: ${brId}\n` +
          (taskId ? `• task: ${taskId}\n` : "") +
          (created ? `• создано: ${created}\n` : "") +
          `• статус: ${status}\n` +
          errLine +
          (summary.length ? `\n🧾 Сводка:\n- ${summary.slice(0, 8).join("\n- ")}\n` : "") +
          `\n🧩 Артефакты:\n${artsLines.join("\n")}\n` +
          `\n🧾 Логи (первые 20):\n${logLines.join("\n")}`
      );
    } catch (e: any) {
      await ctx.reply(`❌ /build_result ошибка: ${e?.message || String(e)}`);
    }
  });

  bot.command("build_trace", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";

      if (!isMaker(uid, priv)) {
        await ctx.reply(`⛔ ${MSG.makerOnly}`);
        return;
      }

      const raw = String((ctx as any)?.message?.text || "").trim();
      const m = raw.match(/^\/build_trace(?:@\w+)?\s+([0-9a-fA-F-]{16,})/);
      const traceId = String(m?.[1] || "").trim();

      if (!traceId) {
        await ctx.reply("Формат: /build_trace <trace_id>");
        return;
      }

      if (!traceExists(telegaRoot, traceId)) {
        await ctx.reply(MSG.reply.traceNotFound(traceId));
        return;
      }

      const x = explainTrace(telegaRoot, traceId);
      const text = formatTraceExplainWithDiff(telegaRoot, traceId);
      let kb;
      if (x.ok === false) {
        const hardLimit = 8;
        const depth = walkRetryChain(telegaRoot, traceId, 20).depth;
        const retryBtn =
          depth >= hardLimit
            ? Markup.button.callback(MSG.btn.retryLimit(depth), `retry_blocked:${traceId}`)
            : Markup.button.callback(MSG.btn.retry, `retry:${traceId}`);
        const row: any[] = [retryBtn];
        if (x.retry_of) {
          row.push(Markup.button.callback(MSG.btn.chain, `retry_chain:${traceId}`));
        }
        kb = Markup.inlineKeyboard([row]);
      }
      if (kb) {
        await ctx.reply(text, kb);
      } else {
        await ctx.reply(text);
      }
    } catch (e: any) {
      await ctx.reply(`❌ /build_trace failed: ${e?.message || String(e)}`);
    }
  });

  bot.command("build_results", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";

      if (!isMaker(uid, priv)) {
        return ctx.reply(`⛔ ${MSG.makerOnly}`);
      }

      const raw = String((ctx as any)?.message?.text || "").trim();
      const parts = raw.split(/\s+/g).filter(Boolean);
      const page = Number(parts[1] || "1") || 1;

      const payload = renderBuildResultsPayload(page);
      const sent: any = await ctx.reply(payload.text, payload.keyboard);
      lastResultsListMsg.set(keyOf(ctx), {
        message_id: Number(sent?.message_id || 0),
        page,
        updated_at: Date.now(),
      });
      return;
    } catch (e: any) {
      await ctx.reply(`❌ /build_results failed: ${e?.message || String(e)}`);
    }
  });

  bot.action(/^brp:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);

      const page = Number((ctx as any)?.match?.[1] || "1") || 1;
      const payload = renderBuildResultsPayload(page);

      await ctx.answerCbQuery("Page");
      await (ctx as any).editMessageText(payload.text, {
        reply_markup: (payload.keyboard as any).reply_markup,
      });
    } catch {
      try {
        await ctx.answerCbQuery(MSG.error);
      } catch {}
    }
  });

  bot.action(/^brr:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);

      const page = Number((ctx as any)?.match?.[1] || "1") || 1;
      const payload = renderBuildResultsPayload(page);

      await ctx.answerCbQuery("Refreshed");
      await (ctx as any).editMessageText(payload.text, {
        reply_markup: (payload.keyboard as any).reply_markup,
      });
    } catch {
      try {
        await ctx.answerCbQuery(MSG.error);
      } catch {}
    }
  });

  bot.action(/^brj:(\d+):(-?\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly, { show_alert: true });

      const cur = Number((ctx as any)?.match?.[1] || "1") || 1;
      const delta = Number((ctx as any)?.match?.[2] || "0") || 0;

      const nextPage = Math.max(1, cur + delta);
      const payload = renderBuildResultsPayload(nextPage);

      await ctx.answerCbQuery(delta > 0 ? `+${delta}` : `${delta}`);
      await (ctx as any).editMessageText(payload.text, {
        reply_markup: (payload.keyboard as any).reply_markup,
      });
    } catch {
      try {
        await ctx.answerCbQuery(MSG.error, { show_alert: true });
      } catch {}
    }
  });

  bot.action(/^brl:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);

      const page = Number((ctx as any)?.match?.[1] || "1") || 1;
      const payload = renderBuildResultsPayload(page);

      await ctx.answerCbQuery("В конец");
      await (ctx as any).editMessageText(payload.text, {
        reply_markup: (payload.keyboard as any).reply_markup,
      });
    } catch {
      try {
        await ctx.answerCbQuery(MSG.error);
      } catch {}
    }
  });

  bot.action(/^brc:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);

      await ctx.answerCbQuery("Cleared");
      await (ctx as any).deleteMessage();
    } catch {
      try {
        await ctx.answerCbQuery("Can't delete");
      } catch {}
    }
  });

  bot.action(/^brs:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly, { show_alert: true });

      gcPending();
      const page = Number((ctx as any)?.match?.[1] || "1") || 1;
      const k = keyOf(ctx);
      const last = lastResultsListMsg.get(k);
      const listMsgId =
        Number(last?.message_id || 0) ||
        Number((ctx as any)?.callbackQuery?.message?.message_id || 0);

      pendingSearch.set(k, {
        kind: "build_results_search",
        created_at: Date.now(),
        page,
        list_message_id: listMsgId,
      });

      await ctx.answerCbQuery("Search");
      await (ctx as any).reply(
        `🔍 Введи часть названия Pack (one-shot, 60s).\n` +
          `Пример: guardian\n` +
          `Отправь одним сообщением — я покажу топ-10 совпадений.`
      );
    } catch {
      try {
        await ctx.answerCbQuery(MSG.error, { show_alert: true });
      } catch {}
    }
  });

  bot.command("build_find", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.reply(`⛔ ${MSG.makerOnly}`);

      const raw = String((ctx as any)?.message?.text || "").trim();
      const parts = raw.split(/\s+/g).filter(Boolean);
      const q = parts.slice(1).join(" ").trim();

      if (!q) return ctx.reply("Формат: /build_find <substring>\nПример: /build_find guardian");

      const items = findBuildResultsByPack(telegaRoot, q, 10);
      if (items.length === 0) return ctx.reply(`🔍 По \"${q}\" ничего не найдено.`);

      const lines = items.map((it, i) => {
        const when = (it.created_at || "").slice(11, 19) || "??:??:??";
        const err = it.status === "failed" && it.error?.message ? ` • err: ${it.error.message}` : "";
        return `${i + 1}) ${when} • ${it.pack} • ${it.status} • ${it.id}${err}`;
      });

      const buttons = items.map((it, i) => Markup.button.callback(`📦 #${i + 1} ${it.pack}`, `br:${it.id}`));
      const rows: any[] = [];
      for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
      rows.push([Markup.button.callback("🗑 Очистить", "brc:1")]);

      await ctx.reply(
        `🔍 Найдено (топ ${items.length}) по \"${q}\"\n${lines.join("\n")}\n\nНажми чтобы открыть:`,
        Markup.inlineKeyboard(rows)
      );
    } catch (e: any) {
      await ctx.reply(`❌ /build_find failed: ${e?.message || String(e)}`);
    }
  });

  bot.action(/^br:(.+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly, { show_alert: true });

      const brId = String((ctx as any)?.match?.[1] || "").trim();
      if (!brId) return ctx.answerCbQuery(MSG.badId);

      const inboxDir = path.join(telegaRoot, "mission-control", "buildtasks", "inbox");
      const file = brId.endsWith(".json") ? brId : `${brId}.json`;
      const abs = path.join(inboxDir, file);

      if (!fs.existsSync(abs)) {
        await ctx.answerCbQuery("Not found", { show_alert: true });
        await (ctx as any).reply(`❌ BuildResult не найден: inbox/${file}`);
        return;
      }

      const res = JSON.parse(fs.readFileSync(abs, "utf8"));

      const status = String(res?.status || "unknown");
      const taskId = String(res?.task_id || "");
      const created = String(res?.created_at || "");
      const summary: string[] = Array.isArray(res?.summary) ? res.summary : [];
      const artifacts: any[] = Array.isArray(res?.artifacts) ? res.artifacts : [];
      const logs: string[] =
        Array.isArray(res?.logs?.lines) ? res.logs.lines : Array.isArray(res?.logs) ? res.logs : [];

      const errMsg = String(res?.error?.message || "");
      const errLine = errMsg ? `• error: ${errMsg}\n` : "";

      const artsLines =
        artifacts.length === 0
          ? ["- (none)"]
          : artifacts
              .slice(0, 10)
              .map((a: any) => `- ${a.type || "file"} • ${a.path}${a.note ? ` — ${a.note}` : ""}`);

      const logLines =
        logs.length === 0 ? ["- (no logs)"] : logs.slice(0, 20).map((l) => `- ${String(l)}`);

      await ctx.answerCbQuery("Открыто");

      await (ctx as any).reply(
        `📦 BuildResult\n` +
          `• id: ${brId}\n` +
          (taskId ? `• task: ${taskId}\n` : "") +
          (created ? `• создано: ${created}\n` : "") +
          `• статус: ${status}\n` +
          errLine +
          (summary.length ? `\n🧾 Сводка:\n- ${summary.slice(0, 8).join("\n- ")}\n` : "") +
          `\n🧩 Артефакты:\n${artsLines.join("\n")}\n` +
          `\n🧾 Логи (первые 20):\n${logLines.join("\n")}`
      );
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(MSG.error, { show_alert: true });
      } catch {}
      await (ctx as any).reply(`❌ build_result click failed: ${e?.message || String(e)}`);
    }
  });

  bot.action(/^trace:([0-9a-fA-F-]{16,})$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly, { show_alert: true });

      const traceId = String((ctx as any)?.match?.[1] || "").trim();
      if (!traceId) return ctx.answerCbQuery(MSG.badId);

      await ctx.answerCbQuery("Поясняю…");

      if (!traceExists(telegaRoot, traceId)) {
        await (ctx as any).reply(MSG.reply.traceNotFound(traceId));
        return;
      }

      const x = explainTrace(telegaRoot, traceId);
      const text = formatTraceExplainWithDiff(telegaRoot, traceId);
      let kb;
      if (x.ok === false) {
        const hardLimit = 8;
        const depth = walkRetryChain(telegaRoot, traceId, 20).depth;
        const retryBtn =
          depth >= hardLimit
            ? Markup.button.callback(MSG.btn.retryLimit(depth), `retry_blocked:${traceId}`)
            : Markup.button.callback(MSG.btn.retry, `retry:${traceId}`);
        const row: any[] = [retryBtn];
        if (x.retry_of) {
          row.push(Markup.button.callback(MSG.btn.chain, `retry_chain:${traceId}`));
        }
        kb = Markup.inlineKeyboard([row]);
      }
      if (kb) {
        await (ctx as any).reply(text, kb);
      } else {
        await (ctx as any).reply(text);
      }
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(MSG.error, { show_alert: true });
      } catch {}
      await (ctx as any).reply(`❌ trace explain failed: ${e?.message || String(e)}`);
    }
  });

  bot.action(/^retry:([0-9a-fA-F-]{16,})$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly, { show_alert: true });

      const oldTraceId = String((ctx as any)?.match?.[1] || "").trim();
      if (!oldTraceId) return ctx.answerCbQuery(MSG.badId);

      let didCb = false;

      const softLimit = 5;
      const guard = walkRetryChain(telegaRoot, oldTraceId, 10);
      if (guard.depth >= softLimit) {
        try {
          await ctx.answerCbQuery(MSG.cb.manyRetries(guard.depth), { show_alert: true });
          didCb = true;
        } catch {}
      }

      let src: ReturnType<typeof explainTrace> | null = null;
      const cooldownMs = 10_000;
      if (traceExists(telegaRoot, oldTraceId)) {
        src = explainTrace(telegaRoot, oldTraceId);
        const lastAt = src.last_event_at ? Number(src.last_event_at) : 0;
        if (lastAt > 0) {
          const ageMs = Date.now() - lastAt;
          if (ageMs >= 0 && ageMs < cooldownMs) {
            const left = Math.ceil((cooldownMs - ageMs) / 1000);
            try {
              await ctx.answerCbQuery(MSG.cb.cooldownWait(left), { show_alert: true });
              didCb = true;
            } catch {}
          }
        }
      }

      if (!didCb) {
        await ctx.answerCbQuery(MSG.cb.retrying);
      }

      if (src) {
        const h = buildReasonHintForSingleTrace(src);
        await (ctx as any).reply(
          MSG.reply.retryReasonSource(h.reason, h.lastStage, h.error)
        );
      }

      const sourceTaskId = findTaskIdByTrace(telegaRoot, oldTraceId);
      if (!sourceTaskId) {
        await (ctx as any).reply(MSG.reply.sourceTaskNotFound);
        return;
      }

      const r = retryBuildTask(telegaRoot, sourceTaskId, oldTraceId);
      await (ctx as any).reply(
        MSG.reply.retryQueued(oldTraceId, r.task.id, guard.depth),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(MSG.btn.openResults, "results_page:1"),
            Markup.button.callback(MSG.btn.explainSource, `trace:${oldTraceId}`),
          ],
        ])
      );
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(MSG.cb.retryFailed, { show_alert: true });
      } catch {}
      await (ctx as any).reply(MSG.reply.retryFailed(e?.message || String(e)));
    }
  });

  bot.action(/^retry_blocked:([0-9a-fA-F-]{16,})$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly, { show_alert: true });

      await ctx.answerCbQuery(MSG.cb.retryLimitReached, { show_alert: true });
    } catch {
      try {
        await ctx.answerCbQuery(MSG.error, { show_alert: true });
      } catch {}
    }
  });

  bot.action(/^retry_chain:([0-9a-fA-F-]{16,})$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly, { show_alert: true });

      const traceId = String((ctx as any)?.match?.[1] || "").trim();
      if (!traceId) return ctx.answerCbQuery(MSG.badId);

      const guard = walkRetryChain(telegaRoot, traceId, 20);
      const chain = guard.chain.map((id) => id.slice(0, 8)).reverse().join(" → ");

      let text = MSG.reply.chainText(guard.depth, guard.root.slice(0, 8), chain);

      if (guard.truncated) text += MSG.reply.chainTruncated(20);
      if (guard.cycle) text += MSG.reply.chainCycle;

      await ctx.answerCbQuery(MSG.cb.chain);
      await (ctx as any).reply(text);
    } catch {
      try {
        await ctx.answerCbQuery(MSG.error, { show_alert: true });
      } catch {}
    }
  });

  bot.action(/^results_page:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly);

      const pageRaw = Number((ctx as any)?.match?.[1] || "1") || 1;
      const page = Math.max(1, pageRaw);
      const payload = renderBuildResultsPayload(page);

      await ctx.answerCbQuery(MSG.cb.results);
      await (ctx as any).reply(payload.text, payload.keyboard);
    } catch {
      try {
        await ctx.answerCbQuery(MSG.error);
      } catch {}
    }
  });

  bot.on("text", async (ctx) => {
    // one-shot search capture (must be first)
    try {
      gcPending();
      const k = keyOf(ctx);
      const pend = pendingSearch.get(k);
      if (pend?.kind === "build_results_search") {
        let text = String((ctx as any)?.message?.text || "").trim();
        text = text.slice(0, 64);
        text = text.replace(/[^\p{L}\p{N}\s._\-•/]/gu, "");
        text = text.trim();
        if (!text.startsWith("/")) {
          const page = pend.page;
          pendingSearch.delete(k);

          const items = findBuildResultsByPack(telegaRoot, text, 10);
          if (items.length === 0) {
            await ctx.reply(`🔍 По \"${text}\" ничего не найдено.`);
            return;
          }

          const lines = items.map((it, i) => {
            const when = (it.created_at || "").slice(11, 19) || "??:??:??";
            const err =
              it.status === "failed" && it.error?.message ? ` • err: ${it.error.message}` : "";
            return `${i + 1}) ${when} • ${it.pack} • ${it.status} • ${it.id}${err}`;
});

  bot.action("voice:toggle", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
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
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram-action] voice:speak clicked", { user_id: uid, chat_id: chatIdStr, label });

      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }

      await handleTTSOutput(ctx, chatIdStr, uid, lastResponse.response_text);
    } catch (e: any) {
      console.error("[telegram-action] voice:speak failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.command("voice_on", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      await toggleVoiceMode(chatIdStr, uid, true);
      const status = formatVoiceStatus(chatIdStr, uid, lang);
      await ctx.reply(status);
    } catch (e: any) {
      console.error("[telegram] /voice_on failed", e?.message || e);
    }
  });

  bot.command("voice_off", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      await toggleVoiceMode(chatIdStr, uid, false);
      const status = formatVoiceStatus(chatIdStr, uid, lang);
      await ctx.reply(status);
    } catch (e: any) {
      console.error("[telegram] /voice_off failed", e?.message || e);
    }
  });

  bot.command("voice_status", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const status = formatVoiceStatus(chatIdStr, uid, lang);
      await ctx.reply(status);
    } catch (e: any) {
      console.error("[telegram] /voice_status failed", e?.message || e);
    }
  });

  bot.command("image", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const prompt = args.join(" ").trim();

      if (!prompt) {
        await ctx.reply(lang === "ru"
          ? "Использование: /image <описание>\nПример: /image закат солнца на пляже"
          : "Usage: /image <description>\nExample: /image sunset on the beach");
        return;
      }

      console.log("[telegram] /image command", { user_id: uid, chat_id: chatIdStr, label, prompt: prompt.slice(0, 50) });

      await ctx.reply(lang === "ru" ? "🎨 Генерирую изображение..." : "🎨 Generating image...");

      const result = await generateImage(ctx, uid, chatIdStr, prompt);

      if (result.success && result.urls) {
        await sendImageToTelegram(ctx, result.urls, lang);
        await ctx.reply(lang === "ru" ? "✅ Готово!" : "✅ Done!");
      } else {
        await ctx.reply(`❌ ${result.error || (lang === "ru" ? "Ошибка" : "Error")}`);
      }
    } catch (e: any) {
      console.error("[telegram] /image failed", e?.message || e);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      await ctx.reply(lang === "ru" ? "❌ Ошибка генерации" : "❌ Generation failed");
    }
  });

  bot.command("images", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const images = await getUserImages(uid);
      const formatted = formatUserImages(images, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /images failed", e?.message || e);
    }
  });

  bot.command("mcp_status", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram] /mcp_status", { user_id: uid });

      const status = await checkMCPHealth();
      const formatted = formatMCPStatus(status, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /mcp_status failed", e?.message || e);
    }
  });

  bot.command("mcp_tools", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram] /mcp_tools", { user_id: uid });

      const status = await checkMCPHealth();
      const formatted = formatMCPStatus(status, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /mcp_tools failed", e?.message || e);
    }
  });

  bot.command("mcp_test", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const label = getAccountLabel(uid);

      console.log("[telegram] /mcp_test", { user_id: uid, label });

      const result = await callMCPTool("telegpt_health", {}, uid, label);
      const formatted = formatMCPTestResult(result, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /mcp_test failed", e?.message || e);
    }
  });

  bot.command("kilo_status", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram] /kilo_status", { user_id: uid });

      const status = await checkKiloStatus();
      const formatted = formatKiloStatus(status, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /kilo_status failed", e?.message || e);
    }
  });

  bot.command("kilo_tools", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram] /kilo_tools", { user_id: uid });

      const status = await checkKiloStatus();
      const formatted = formatKiloStatus(status, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /kilo_tools failed", e?.message || e);
    }
  });

  bot.command("kilo_ping", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const label = getAccountLabel(uid);

      console.log("[telegram] /kilo_ping", { user_id: uid, label });

      const result = await kiloPing(uid, label, lang);
      await ctx.reply(result);
    } catch (e: any) {
      console.error("[telegram] /kilo_ping failed", e?.message || e);
    }
  });

  bot.command("kilo_workspace", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const label = getAccountLabel(uid);

      console.log("[telegram] /kilo_workspace", { user_id: uid, label });

      await ctx.reply(lang === "ru" ? "📁 Проверяю workspace..." : "📁 Checking workspace...");

      const result = await kiloWorkspace(uid, label, lang);
      await ctx.reply(result);
    } catch (e: any) {
      console.error("[telegram] /kilo_workspace failed", e?.message || e);
    }
  });

  bot.command("kilo_read", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const filePath = args.join(" ").trim();

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const label = getAccountLabel(uid);

      console.log("[telegram] /kilo_read", { user_id: uid, label, path: filePath });

      if (!filePath) {
        await ctx.reply(lang === "ru"
          ? "Использование: /kilo_read <путь>\nПример: /kilo_read src/index.ts"
          : "Usage: /kilo_read <path>\nExample: /kilo_read src/index.ts");
        return;
      }

      await ctx.reply(lang === "ru" ? "📖 Читаю файл..." : "📖 Reading file...");

      const result = await kiloRead(uid, label, filePath, lang);
      await ctx.reply(result, { parse_mode: "Markdown" });
    } catch (e: any) {
      console.error("[telegram] /kilo_read failed", e?.message || e);
    }
  });

  bot.command("kilo_grep", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const pattern = args.join(" ").trim();

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const label = getAccountLabel(uid);

      console.log("[telegram] /kilo_grep", { user_id: uid, label, pattern });

      if (!pattern) {
        await ctx.reply(lang === "ru"
          ? "Использование: /kilo_grep <pattern> [path]\nПример: /kilo_grep function"
          : "Usage: /kilo_grep <pattern> [path]\nExample: /kilo_grep function");
        return;
      }

      await ctx.reply(lang === "ru" ? "🔍 Ищу..." : "🔍 Searching...");

      const result = await kiloGrep(uid, label, pattern, lang);
      await ctx.reply(result, { parse_mode: "Markdown" });
    } catch (e: any) {
      console.error("[telegram] /kilo_grep failed", e?.message || e);
    }
  });

  bot.command("kilo_patch_plan", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const task = args.join(" ").trim();

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const label = getAccountLabel(uid);

      console.log("[telegram] /kilo_patch_plan", { user_id: uid, label, task: task.slice(0, 50) });

      if (!task) {
        await ctx.reply(lang === "ru"
          ? "Использование: /kilo_patch_plan <задача>\nПример: /kilo_patch_plan добавить логирование в router"
          : "Usage: /kilo_patch_plan <task>\nExample: /kilo_patch_plan add logging to router");
        return;
      }

      await ctx.reply(lang === "ru" ? "🧠 Создаю patch план..." : "🧠 Creating patch plan...");

      const result = await createPatchPlan(uid, label, task, lang);

      if (result.error) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      await ctx.reply(`✅ ${lang === "ru" ? "Patch план создан" : "Patch plan created"}: ${result.plan_id}`);
    } catch (e: any) {
      console.error("[telegram] /kilo_patch_plan failed", e?.message || e);
    }
  });

  bot.command("kilo_patch_preview", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const planId = args.join(" ").trim();

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      if (!planId) {
        await ctx.reply(lang === "ru" ? "Использование: /kilo_patch_preview <plan_id>" : "Usage: /kilo_patch_preview <plan_id>");
        return;
      }

      const result = await previewPatch(planId, uid, lang);
      await ctx.reply(result, { parse_mode: "Markdown" });
    } catch (e: any) {
      console.error("[telegram] /kilo_patch_preview failed", e?.message || e);
    }
  });

  bot.command("kilo_patch_apply", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const canApply = label === "★" || label === "★★";
      if (!canApply) {
        await ctx.reply(lang === "ru"
          ? "❌ Только ★ и ★★ могут применять patch"
          : "❌ Only ★ and ★★ can apply patches");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const planId = args.join(" ").trim();

      if (!planId) {
        await ctx.reply(lang === "ru" ? "Использование: /kilo_patch_apply <plan_id>" : "Usage: /kilo_patch_apply <plan_id>");
        return;
      }

      console.log("[telegram] /kilo_patch_apply", { user_id: uid, label, plan_id: planId });

      await ctx.reply(lang === "ru" ? "🔧 Применяю patch..." : "🔧 Applying patch...");

      const result = await applyPatch(planId, uid, label, lang);

      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      await ctx.reply(`✅ ${lang === "ru" ? "Patch применён" : "Patch applied"}: ${result.apply_id}`);

      const verifyResult = await verifyApply(result.apply_id!, uid, label, lang);
      await ctx.reply(verifyResult, { parse_mode: "Markdown" });
    } catch (e: any) {
      console.error("[telegram] /kilo_patch_apply failed", e?.message || e);
    }
  });

  bot.command("kilo_patch_status", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const role = getTelegramRole(uid);
      if (role !== "owner") {
        await ctx.reply("Owner only");
        return;
      }

      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const list = formatPatchList(lang);
      await ctx.reply(list);
    } catch (e: any) {
      console.error("[telegram] /kilo_patch_status failed", e?.message || e);
    }
  });

  bot.command("kilo_patch_rollback", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const canApply = label === "★" || label === "★★";
      if (!canApply) {
        await ctx.reply(lang === "ru"
          ? "❌ Только ★ и ★★ могут откатывать"
          : "❌ Only ★ and ★★ can rollback");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const applyId = args.join(" ").trim();

      if (!applyId) {
        await ctx.reply(lang === "ru" ? "Использование: /kilo_patch_rollback <apply_id>" : "Usage: /kilo_patch_rollback <apply_id>");
        return;
      }

      console.log("[telegram] /kilo_patch_rollback", { user_id: uid, label, apply_id: applyId });

      await ctx.reply(lang === "ru" ? "↩️ Откатываю..." : "↩️ Rolling back...");

      const result = await rollbackApply(applyId, uid, label, lang);

      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      await ctx.reply(`✅ ${lang === "ru" ? "Откат выполнен" : "Rollback complete"}`);
    } catch (e: any) {
      console.error("[telegram] /kilo_patch_rollback failed", e?.message || e);
    }
  });

  bot.command("forge_task", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const perms = await canManageForgeTask(label);
      if (!perms.create) {
        await ctx.reply(lang === "ru"
          ? "❌ Создание task только для ★/★★★"
          : "❌ Task creation only for ★/★★★");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const taskDesc = args.join(" ").trim();

      if (!taskDesc) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_task <задача>\nПример: /forge_task добавить валидацию в форму"
          : "Usage: /forge_task <task>\nExample: /forge_task add validation to form");
        return;
      }

      console.log("[telegram] /forge_task", { user_id: uid, label, task: taskDesc.slice(0, 50) });

      const titleMatch = taskDesc.match(/^([^\n]+)/);
      const title = titleMatch ? titleMatch[1].slice(0, 50) : taskDesc.slice(0, 50);

      await ctx.reply(lang === "ru" ? "🔨 Создаю task..." : "🔨 Creating task...");

      const result = await createForgeTask(uid, label, title, taskDesc, lang);

      if (result.error) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      await ctx.reply(`✅ ${lang === "ru" ? "Task создан" : "Task created"}: ${result.task_id}`);

      if (perms.apply) {
        await ctx.reply(lang === "ru"
          ? "Применяю task..."
          : "Applying task...");

        const execResult = await handleForgeTask(result.task_id!, uid, label, lang);
        if (execResult.ok) {
          await ctx.reply(lang === "ru" ? "✅ Task выполнен!" : "✅ Task completed!");
        } else {
          await ctx.reply(`⚠️ ${execResult.error}`);
        }
      }
    } catch (e: any) {
      console.error("[telegram] /forge_task failed", e?.message || e);
    }
  });

  bot.command("forge_status", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const taskId = args.join(" ").trim();

      if (taskId) {
        const task = await getForgeTask(taskId);
        if (!task) {
          await ctx.reply(lang === "ru" ? "Task не найден" : "Task not found");
          return;
        }
        const formatted = formatForgeTask(task, lang);
        await ctx.reply(formatted);
        return;
      }

      const label = getAccountLabel(uid);
      const tasks = await listForgeTasks(uid, label);
      const formatted = formatForgeTaskList(tasks, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /forge_status failed", e?.message || e);
    }
  });

  bot.command("forge_apply", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const perms = await canManageForgeTask(label);
      if (!perms.apply) {
        await ctx.reply(lang === "ru"
          ? "❌ Применение только для ★"
          : "❌ Apply only for ★");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const taskId = args.join(" ").trim();

      if (!taskId) {
        await ctx.reply(lang === "ru" ? "Использование: /forge_apply <task_id>" : "Usage: /forge_apply <task_id>");
        return;
      }

      console.log("[telegram] /forge_apply", { user_id: uid, label, task_id: taskId });

      await ctx.reply(lang === "ru" ? "🔨 Применяю task..." : "🔨 Applying task...");

      const result = await handleForgeTask(taskId, uid, label, lang);

      if (result.ok) {
        await ctx.reply(lang === "ru" ? "✅ Task выполнен!" : "✅ Task completed!");
      } else {
        await ctx.reply(`❌ ${result.error}`);
      }
    } catch (e: any) {
      console.error("[telegram] /forge_apply failed", e?.message || e);
    }
  });

  bot.command("forge_rollback", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const perms = await canManageForgeTask(label);
      if (!perms.rollback) {
        await ctx.reply(lang === "ru"
          ? "❌ Rollback только для ★"
          : "❌ Rollback only for ★");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const taskId = args.join(" ").trim();

      if (!taskId) {
        await ctx.reply(lang === "ru" ? "Использование: /forge_rollback <task_id>" : "Usage: /forge_rollback <task_id>");
        return;
      }

      const task = await getForgeTask(taskId);
      if (!task?.apply_id) {
        await ctx.reply(lang === "ru" ? "Нет apply для отката" : "No apply to rollback");
        return;
      }

      console.log("[telegram] /forge_rollback", { user_id: uid, label, task_id: taskId });

      const result = await rollbackApply(task.apply_id, uid, label, lang);

      if (result.ok) {
        await updateForgeTask(taskId, { status: "rolled_back" });
        await ctx.reply(lang === "ru" ? "↩️ Task откачен" : "↩️ Task rolled back");
      } else {
        await ctx.reply(`❌ ${result.error}`);
      }
    } catch (e: any) {
      console.error("[telegram] /forge_rollback failed", e?.message || e);
    }
  });

  bot.command("forge_history", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const tasks = await listForgeTasks(uid, label, 20);
      const formatted = formatForgeTaskList(tasks, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /forge_history failed", e?.message || e);
    }
  });

  bot.command("forge_new", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      let taskDesc = args.join(" ").trim();

      if (!taskDesc) {
        const stageHelp = STAGES.map(s => s).join(", ");
        await ctx.reply(lang === "ru"
          ? `Использование: /forge_new <задача> [--stop-at <стадия>]\nДоступные стадии: ${stageHelp}\nПример: /forge_new добавить логирование --stop-at plan`
          : `Usage: /forge_new <task> [--stop-at <stage>]\nStages: ${stageHelp}\nExample: /forge_new add logging --stop-at plan`);
        return;
      }

      let stopAt: string | undefined;
      const stopMatch = taskDesc.match(/--stop-at\s+(\w+)/);
      if (stopMatch) {
        stopAt = stopMatch[1] as WorkflowStage;
        taskDesc = taskDesc.replace(/--stop-at\s+\w+/, "").trim();
      }

      console.log("[telegram] /forge_new", { user_id: uid, label, task: taskDesc.slice(0, 50), stop_at: stopAt });

      const titleMatch = taskDesc.match(/^([^\n]+)/);
      const title = titleMatch ? titleMatch[1].slice(0, 50) : taskDesc.slice(0, 50);

      await ctx.reply(lang === "ru" ? "🔨 Создаю workflow..." : "🔨 Creating workflow...");

      const result = await createWorkflow(uid, label, title, taskDesc, lang, { stopAt: stopAt as WorkflowStage });

      if (result.error) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      await ctx.reply(`✅ ${lang === "ru" ? "Workflow создан" : "Workflow created"}: ${result.workflow_id}`);

      const wf = await getWorkflow(result.workflow_id!);
      if (wf) {
        await ctx.reply(formatWorkflowVisualization(wf, lang));
      }
    } catch (e: any) {
      console.error("[telegram] /forge_new failed", e?.message || e);
    }
  });

  bot.command("forge_next", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_next <workflow_id>"
          : "Usage: /forge_next <workflow_id>");
        return;
      }

      console.log("[telegram] /forge_next", { user_id: uid, label, workflow_id: workflowId });

      await ctx.reply(lang === "ru" ? "⏭️ Выполняю стадию..." : "⏭️ Executing stage...");

      const result = await executeStage(workflowId, uid, label, lang);

      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      const wf = await getWorkflow(workflowId);
      if (wf) {
        await ctx.reply(formatWorkflowVisualization(wf, lang));

        if (wf.current_stage === "complete") {
          await ctx.reply(lang === "ru" ? "✅ Workflow завершён!" : "✅ Workflow complete!");
        }
      }
    } catch (e: any) {
      console.error("[telegram] /forge_next failed", e?.message || e);
    }
  });

  bot.command("forge_stage", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_stage <workflow_id>"
          : "Usage: /forge_stage <workflow_id>");
        return;
      }

      const wf = await getWorkflow(workflowId);
      if (!wf) {
        await ctx.reply(lang === "ru" ? "Workflow не найден" : "Workflow not found");
        return;
      }

      await ctx.reply(formatWorkflowVisualization(wf, lang));
    } catch (e: any) {
      console.error("[telegram] /forge_stage failed", e?.message || e);
    }
  });

  bot.command("forge_skip", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_skip <workflow_id>"
          : "Usage: /forge_skip <workflow_id>");
        return;
      }

      const wf = await getWorkflow(workflowId);
      if (!wf) {
        await ctx.reply(lang === "ru" ? "Workflow не найден" : "Workflow not found");
        return;
      }

      const current = wf.current_stage;
      const result = await skipStage(workflowId, current, uid, label, lang);

      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      await ctx.reply(lang === "ru" ? "⏭️ Стадия пропущена" : "⏭️ Stage skipped");

      const updated = await getWorkflow(workflowId);
      if (updated) {
        await ctx.reply(formatWorkflowVisualization(updated, lang));
      }
    } catch (e: any) {
      console.error("[telegram] /forge_skip failed", e?.message || e);
    }
  });

  bot.command("forge_restart", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      let workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_restart <workflow_id> [стадия]"
          : "Usage: /forge_restart <workflow_id> [stage]");
        return;
      }

      let fromStage: WorkflowStage = "intent";
      const stageMatch = workflowId.match(/\s+(\w+)$/);
      if (stageMatch && STAGES.includes(stageMatch[1] as WorkflowStage)) {
        fromStage = stageMatch[1] as WorkflowStage;
        workflowId = workflowId.replace(/\s+\w+$/, "").trim();
      }

      console.log("[telegram] /forge_restart", { user_id: uid, workflow_id: workflowId, from_stage: fromStage });

      const result = await restartWorkflow(workflowId, fromStage);

      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      const wf = await getWorkflow(workflowId);
      if (wf) {
        await ctx.reply(formatWorkflowVisualization(wf, lang));
      }
    } catch (e: any) {
      console.error("[telegram] /forge_restart failed", e?.message || e);
    }
  });

  bot.command("forge_list", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const workflows = await listWorkflows(uid);
      const formatted = formatWorkflowList(workflows, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /forge_list failed", e?.message || e);
    }
  });

  bot.command("forge_gates", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_gates <workflow_id>"
          : "Usage: /forge_gates <workflow_id>");
        return;
      }

      console.log("[telegram] /forge_gates", { user_id: uid, workflow_id: workflowId });

      const report = await checkGates(workflowId, lang);
      await ctx.reply(report, { parse_mode: "Markdown" });
    } catch (e: any) {
      console.error("[telegram] /forge_gates failed", e?.message || e);
    }
  });

  bot.command("forge_validate", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_validate <workflow_id>"
          : "Usage: /forge_validate <workflow_id>");
        return;
      }

      const workflow = await getWorkflow(workflowId);
      if (!workflow) {
        await ctx.reply(lang === "ru" ? "Workflow не найден" : "Workflow not found");
        return;
      }

      const currentStage = workflow.current_stage;
      const gate = await validateGate(workflowId, currentStage, workflow, lang);
      const report = formatValidationReport(gate, lang);

      await ctx.reply(report, { parse_mode: "Markdown" });

      if (!gate.passed && (currentStage === "apply" || currentStage === "verify")) {
        await ctx.reply(lang === "ru"
          ? "⚠️ Gate не пройден - переход заблокирован"
          : "⚠️ Gate not passed - transition blocked");
      }
    } catch (e: any) {
      console.error("[telegram] /forge_validate failed", e?.message || e);
    }
  });

  bot.command("forge_timeline", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_timeline <workflow_id>"
          : "Usage: /forge_timeline <workflow_id>");
        return;
      }

      const timeline = await getWorkflowTimeline(workflowId, lang);
      if (!timeline) {
        await ctx.reply(lang === "ru" ? "Timeline не найден" : "Timeline not found");
        return;
      }

      await ctx.reply(timeline);
    } catch (e: any) {
      console.error("[telegram] /forge_timeline failed", e?.message || e);
    }
  });

  bot.command("forge_report", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_report <workflow_id>"
          : "Usage: /forge_report <workflow_id>");
        return;
      }

      console.log("[telegram] /forge_report", { user_id: uid, workflow_id: workflowId });

      const workflow = await getWorkflow(workflowId);
      if (!workflow) {
        await ctx.reply(lang === "ru" ? "Workflow не найден" : "Workflow not found");
        return;
      }

      const { content, isLong } = await exportReport(workflowId, workflow, lang);

      if (isLong) {
        await ctx.reply(content, { parse_mode: "Markdown" });
      } else {
        await ctx.reply(content);
      }
    } catch (e: any) {
      console.error("[telegram] /forge_report failed", e?.message || e);
    }
  });

  bot.command("forge_spawn", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      let input = args.join(" ").trim();

      if (!input) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_spawn <родитель> <задача>"
          : "Usage: /forge_spawn <parent> <task>");
        return;
      }

      let parentId: string | undefined;
      if (input.includes(" ")) {
        const parts = input.split(" ");
        parentId = parts[0].trim();
        input = parts.slice(1).join(" ").trim();
      }

      console.log("[telegram] /forge_spawn", { user_id: uid, label, parent: parentId, task: input.slice(0, 30) });

      if (parentId) {
        await linkToParent(`wf_${Date.now()}`, parentId);
        await ctx.reply(lang === "ru"
          ? `✅ Spawned as child of ${parentId.slice(-8)}`
          : `✅ Spawned as child of ${parentId.slice(-8)}`);
      } else {
        await ctx.reply(lang === "ru"
          ? "✅ Spawned new workflow"
          : "✅ Spawned new workflow");
      }
    } catch (e: any) {
      console.error("[telegram] /forge_spawn failed", e?.message || e);
    }
  });

  bot.command("forge_parallel", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const canParallel = label === "★" || label === "★★";
      if (!canParallel) {
        await ctx.reply(lang === "ru"
          ? "❌ Параллельное исполнение только для ★"
          : "❌ Parallel only for ★");
        return;
      }

      const args = ctx.message?.text?.split("|").map(s => s.trim());
      if (!args || args.length < 2) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_parallel <задача1>|<задача2>"
          : "Usage: /forge_parallel <task1>|<task2>");
        return;
      }

      console.log("[telegram] /forge_parallel", { user_id: uid, tasks: args.length });

      await ctx.reply(lang === "ru"
        ? `🔄 Spawned ${args.length} parallel tasks`
        : `🔄 Spawned ${args.length} parallel tasks`);

      for (let i = 0; i < args.length; i++) {
        const task = args[i];
        await ctx.reply(`${i + 1}. ${task.slice(0, 50)}...`);
      }
    } catch (e: any) {
      console.error("[telegram] /forge_parallel failed", e?.message || e);
    }
  });

  bot.command("forge_graph", async (ctx) => {
    try {
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const graph = formatGraph(lang);
      await ctx.reply(graph);
    } catch (e: any) {
      console.error("[telegram] /forge_graph failed", e?.message || e);
    }
  });

  bot.command("forge_queue", async (ctx) => {
    try {
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const queue = formatQueue(lang);
      await ctx.reply(queue);
    } catch (e: any) {
      console.error("[telegram] /forge_queue failed", e?.message || e);
    }
  });

  bot.command("forge_pause", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_pause <workflow_id>"
          : "Usage: /forge_pause <workflow_id>");
        return;
      }

      console.log("[telegram] /forge_pause", { user_id: uid, workflow_id: workflowId });

      const result = await pauseWorkflow(workflowId);

      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      await ctx.reply(lang === "ru" ? "⏸ Workflow приостановлен" : "⏸ Workflow paused");
    } catch (e: any) {
      console.error("[telegram] /forge_pause failed", e?.message || e);
    }
  });

  bot.command("forge_resume", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_resume <workflow_id>"
          : "Usage: /forge_resume <workflow_id>");
        return;
      }

      console.log("[telegram] /forge_resume", { user_id: uid, workflow_id: workflowId });

      const result = await resumeWorkflow(workflowId);

      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      await ctx.reply(lang === "ru" ? "▶️ Workflow возобновлён" : "▶️ Workflow resumed");
    } catch (e: any) {
      console.error("[telegram] /forge_resume failed", e?.message || e);
    }
  });

  bot.command("forge_checkpoint", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_checkpoint <workflow_id>"
          : "Usage: /forge_checkpoint <workflow_id>");
        return;
      }

      const checkpoints = await getWorkflowCheckpoints(workflowId);
      const formatted = formatCheckpointList(checkpoints, lang);
      await ctx.reply(formatted);
    } catch (e: any) {
      console.error("[telegram] /forge_checkpoint failed", e?.message || e);
    }
  });

  bot.command("forge_recover", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_recover <workflow_id>"
          : "Usage: /forge_recover <workflow_id>");
        return;
      }

      console.log("[telegram] /forge_recover", { user_id: uid, workflow_id: workflowId });

      const result = await recoverWorkflow(workflowId);

      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      await ctx.reply(lang === "ru" ? "🔄 Workflow восстановлен" : "🔄 Workflow recovered");

      if (result.checkpoint) {
        const report = formatRecoveryReport(result.checkpoint, lang);
        await ctx.reply(report);
      }
    } catch (e: any) {
      console.error("[telegram] /forge_recover failed", e?.message || e);
    }
  });

  bot.command("forge_diagnose", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_diagnose <workflow_id> [error_message]"
          : "Usage: /forge_diagnose <workflow_id> [error_message]");
        return;
      }

      const parts = workflowId.split(" ");
      const actualWorkflowId = parts[0];
      const errorMessage = parts.length > 1 ? parts.slice(1).join(" ") : "Workflow failed";

      console.log("[telegram] /forge_diagnose", { user_id: uid, workflow_id: actualWorkflowId });

      const failureType = classifyFailure(errorMessage);
      const diagnosis = formatDiagnosis(actualWorkflowId, failureType, errorMessage, lang);

      await ctx.reply(diagnosis);
    } catch (e: any) {
      console.error("[telegram] /forge_diagnose failed", e?.message || e);
    }
  });

  bot.command("forge_heal_plan", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_heal_plan <workflow_id>"
          : "Usage: /forge_heal_plan <workflow_id>");
        return;
      }

      const canCreate = label === "★" || label === "★★" || label === "★★★";
      if (!canCreate && label === "") {
        await ctx.reply(lang === "ru" ? "Только для ★/★★★" : "Only for ★/★★★");
        return;
      }

      console.log("[telegram] /forge_heal_plan", { user_id: uid, workflow_id: workflowId, label });

      const plan = await createHealPlan(workflowId, "unknown", "Diagnostic scan", uid, lang);

      const formatted = formatHealPlan(plan, lang);
      await ctx.reply(formatted, { parse_mode: "Markdown" });

      if (plan.risk_level === "critical" || plan.risk_level === "high") {
        await ctx.reply(lang === "ru"
          ? "⚠️ Требуется одобрение владельца"
          : "⚠️ Owner approval required");
      }
    } catch (e: any) {
      console.error("[telegram] /forge_heal_plan failed", e?.message || e);
    }
  });

  bot.command("forge_heal_apply", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      const canApply = label === "★" || label === "★★";
      if (!canApply) {
        await ctx.reply(lang === "ru"
          ? "❌ Heal apply только для ★"
          : "❌ Heal apply only for ★");
        return;
      }

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const healId = args.join(" ").trim();

      if (!healId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_heal_apply <heal_id>"
          : "Usage: /forge_heal_apply <heal_id>");
        return;
      }

      console.log("[telegram] /forge_heal_apply", { user_id: uid, heal_id: healId, label });

      const plan = await getHealPlan(healId);
      if (!plan) {
        await ctx.reply(lang === "ru" ? "Heal план не найден" : "Heal plan not found");
        return;
      }

      if (plan.status === "applied") {
        await ctx.reply(lang === "ru" ? "Уже применено" : "Already applied");
        return;
      }

      if (plan.requires_owner_approval && !canApply) {
        await ctx.reply(lang === "ru"
          ? "❌ Требуется одобрение ★"
          : "❌ Requires ★ approval");
        return;
      }

      await updateHealPlanStatus(healId, "approved", label);

      await ctx.reply(lang === "ru"
        ? "✅ Heal план одобрен"
        : "✅ Heal plan approved");

      await updateHealPlanStatus(healId, "applied");

await ctx.reply(lang === "ru"
          ? "✅ Heal применён"
          : "✅ Heal applied");
    } catch (e: any) {
      console.error("[telegram] /forge_heal_apply failed", e?.message || e);
    }
  });

  bot.command("forge_auto", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram] /forge_auto", { user_id: uid, label });

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const task = args.join(" ").trim().replace("--auto-approve", "").trim();
      const autoApprove = ctx.message?.text?.includes("--auto-approve") ?? false;

      if (!task) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_auto <задача> [--auto-approve]"
          : "Usage: /forge_auto <task> [--auto-approve]");
        return;
      }

      const { createWorkflow } = await import("./forge-workflow.js");
      const result = await createWorkflow(uid, label, task, task, lang);

      if (result.error) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }

      const { setAutoMode } = await import("./forge-auto.js");
      const autoResult = await setAutoMode(result.workflow_id!, "autonomous", uid, label, autoApprove, lang);

      if (!autoResult.ok) {
        await ctx.reply(`❌ ${autoResult.error}`);
        return;
      }

      await ctx.reply(lang === "ru"
        ? `🤖 АВТО-РЕЖИМ ВКЛЮЧЕН\nWorkflow: ${result.workflow_id}\nMax loops: 10\nЗапускаю loop...`
        : `🤖 AUTO MODE ENABLED\nWorkflow: ${result.workflow_id}\nMax loops: 10\nStarting loop...`);
    } catch (e: any) {
      console.error("[telegram] /forge_auto failed", e?.message || e);
      await ctx.reply("❌ Auto mode failed");
    }
  });

  bot.command("forge_mode", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram] /forge_mode", { user_id: uid, label });

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args[0];
      const mode = args[1] as any;

      if (!workflowId) {
        const { getAllAutoModes } = await import("./forge-auto.js");
        const records = await getAllAutoModes();
        const active = records.filter((r) => r.status === "active");

        if (active.length === 0) {
          await ctx.reply(lang === "ru"
            ? "Нет активных auto modes"
            : "No active auto modes");
          return;
        }

        const text = active.map((r) =>
          `${r.workflow_id}: ${r.mode} | ${r.current_stage} | loop ${r.loop_count}/${r.max_loops}`
        ).join("\n");

        await ctx.reply(text);
        return;
      }

      if (!["manual", "assisted", "autonomous"].includes(mode)) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_mode <workflow_id> <manual|assisted|autonomous>"
          : "Usage: /forge_mode <workflow_id> <manual|assisted|autonomous>");
        return;
      }

      const { setAutoMode } = await import("./forge-auto.js");
      const result = await setAutoMode(workflowId, mode, uid, label, false, lang);

      await ctx.reply(result.ok
        ? lang === "ru"
          ? `✅ Режим изменён на ${mode}`
          : `✅ Mode changed to ${mode}`
        : `❌ ${result.error}`);
    } catch (e: any) {
      console.error("[telegram] /forge_mode failed", e?.message || e);
    }
  });

  bot.command("forge_stop", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram] /forge_stop", { user_id: uid, label });

      const args = ctx.message?.text?.split(" ").slice(1) || [];
      const workflowId = args.join(" ").trim();

      if (!workflowId) {
        await ctx.reply(lang === "ru"
          ? "Использование: /forge_stop <workflow_id>"
          : "Usage: /forge_stop <workflow_id>");
        return;
      }

      const { stopAutoMode } = await import("./forge-auto.js");
      const result = await stopAutoMode(workflowId, uid, label);

      await ctx.reply(result.ok
        ? lang === "ru"
          ? "✅ Auto mode остановлен"
          : "✅ Auto mode stopped"
        : `❌ ${result.error}`);
    } catch (e: any) {
      console.error("[telegram] /forge_stop failed", e?.message || e);
    }
  });

  bot.on("voice", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram] voice message received", { user_id: uid, chat_id: chatIdStr, label });

      if (!isVoiceModeEnabled(chatIdStr, uid)) {
        await ctx.reply(lang === "ru"
          ? "🔇 Голосовые сообщения отключены. Используйте /voice_on для активации."
          : "🔇 Voice messages disabled. Use /voice_on to activate.");
        return;
      }

      const voiceResult = await handleVoiceInput(ctx, chatIdStr, uid);
      if (voiceResult && voiceResult.transcript) {
        const text = voiceResult.transcript;
        const settings = settingsOf(ctx);
        const selectedProvider = settings.provider || "auto";
        const model = settings.model || providerToModel(selectedProvider);

        console.log("[pantheon-tg] routing voice to /v1/chat", {
          chat_id: chatIdStr,
          telegram_user_id: uid,
          selected_provider: selectedProvider,
          model,
          is_voice: true,
        });

        const webProviderTimeout = (selectedProvider || "").endsWith("_web") ? 180000 : 65000;
        const res = await fetch("http://127.0.0.1:8787/v1/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(webProviderTimeout),
          body: JSON.stringify({
            message: text,
            model,
            task: { type: "chat" },
            meta: {
              source: "telegram-voice",
              telegram_user_id: uid,
              selected_provider: selectedProvider,
              bridge_enabled: settings.bridgeEnabled === true,
              creator_mode: label === "★" || label === "★★",
              chat_id: chatIdStr,
              from: uid,
              is_voice: true,
            },
          }),
        });

        const data = (await res.json().catch(() => ({}))) as any;
        const output = String(data?.output || data?.reply || data?.answer || "").trim();

        if (output) {
          await ctx.reply(output);
        } else {
          await ctx.reply(lang === "ru" ? "❌ Ошибка обработки голоса" : "❌ Voice processing failed");
        }
      } else {
        await ctx.reply(lang === "ru" ? "❌ Не удалось распознать голос" : "❌ Could not transcribe voice");
      }
    } catch (e: any) {
      console.error("[telegram] voice handler failed", e?.message || e);
await ctx.reply("❌ Voice processing failed");
    }
  });

  bot.action(/^forge:(refresh|gates|timeline|diagnose|heal|restart):(.+)$/, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const match = (ctx as any)?.match;

      if (!match) return;

      const action = match[1];
      const workflowId = match[2];

      console.log("[forge-ui] callback", { user_id: uid, action, workflow_id: workflowId });

      switch (action) {
        case "refresh": {
          const workflow = await getWorkflow(workflowId);
          if (workflow) {
            const { text, keyboard } = formatWorkflowCard(workflow, lang);
            await ctx.editMessageText(text, { reply_markup: keyboard as any });
          }
          break;
        }
        case "gates": {
          const gateReport = await checkGates(workflowId, lang);
          await ctx.reply(gateReport);
          break;
        }
        case "timeline": {
          const timeline = await getWorkflowTimeline(workflowId, lang);
          await ctx.reply(timeline);
          break;
        }
        case "diagnose": {
          const diagnosis = formatDiagnosis(workflowId, "unknown", "Manual diagnosis requested", lang);
          await ctx.reply(diagnosis);
          break;
        }
        case "heal": {
          const plan = await createHealPlan(workflowId, "unknown", "Manual heal requested", uid, lang);
          const formatted = formatHealPlan(plan, lang);
          await ctx.reply(formatted, { parse_mode: "Markdown" });
          break;
        }
        case "restart": {
          const result = await restartWorkflow(workflowId, "intent");
          if (result.ok) {
            const workflow = await getWorkflow(workflowId);
            if (workflow) {
              const { text, keyboard } = formatWorkflowCard(workflow, lang);
              await ctx.editMessageText(text, { reply_markup: keyboard as any });
            }
          } else {
            await ctx.answerCbQuery(result.error || "Error", { show_alert: true });
          }
          break;
        }
      }

      await ctx.answerCbQuery("OK");
    } catch (e: any) {
      console.error("[forge-ui] callback failed", e?.message || e);
    }
  });

  bot.on("edited_message", async (ctx) => {
    // Handle message edits if needed
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  await bot.launch();
  console.log("[pantheon-tg] bot launched (polling)");

  return bot;
}
      }
    } catch {
      // ignore
    }

    const text = String((ctx as any)?.message?.text || "").trim();
    if (!text) return;
    if (text.startsWith("/")) return;

    const voiceInput = await handleVoiceInput(ctx, String(chatId(ctx)), String(userIdOf(ctx)));
    if (voiceInput) {
      const voiceText = voiceInput.transcript || voiceInput.text;
      console.log("[pantheon-tg] voice input transcribed", {
        chat_id: chatId(ctx),
        telegram_user_id: userIdOf(ctx),
        transcript: voiceText,
      });
      await ctx.reply(`🎤 ${voiceText}`);
    }

    try {
      const userId = userIdOf(ctx);
      const settings = settingsOf(ctx);
      console.log("[telegram] active settings", {
        user_id: userId,
        provider: settings.provider,
        bridgeEnabled: settings.bridgeEnabled,
        creatorMode: settings.creatorMode
      });
      const selectedProvider = settings.provider || "auto";
      const model = settings.model || providerToModel(selectedProvider);
      console.log("[pantheon-tg] routing text to /v1/chat", {
        chat_id: chatId(ctx),
        telegram_user_id: userId,
        selected_provider: selectedProvider,
        model,
        message_id: (ctx as any)?.message?.message_id,
      });

      const webProviderTimeout = (selectedProvider || "").endsWith("_web") ? 180000 : 65000;
      const res = await fetch("http://127.0.0.1:8787/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(webProviderTimeout),
        body: JSON.stringify({
          message: text,
          model,
          task: { type: "chat" },
          meta: {
            source: "telegram",
            telegram_user_id: userIdOf(ctx),
            selected_provider: selectedProvider,
            bridge_enabled: settings.bridgeEnabled === true,
            creator_mode: settings.creatorMode === true,
            chat_id: chatId(ctx),
            from: String((ctx as any)?.from?.id || ""),
            message_id: (ctx as any)?.message?.message_id,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        const message = String(
          data?.error?.message ||
            data?.message ||
            data?.error ||
            `HTTP ${res.status}`
        );
        if (selectedProvider !== "auto") {
          await ctx.reply(message);
          return;
        }
        throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
      }

      const output = String(data?.output || data?.reply || data?.answer || "").trim();
      if (!output) throw new Error("Empty /v1/chat response");

      const uid = String(userIdOf(ctx));
      const chatIdStr = String(chatId(ctx));
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);
      const label = getAccountLabel(uid);

      await ctx.reply(output);

      await saveActionResponse(
        chatIdStr,
        uid,
        text,
        output,
        selectedProvider,
        data?.request_id || String(Date.now())
      );

      const extra = buildReplyExtra(lang) as any;
      await ctx.reply("━━━━━━━━━━━━━━━━━━━━━━", extra);
    } catch (e: any) {
      const errMsg = e?.message || String(e);
      const activeSettings = settingsOf(ctx);
      let replyMsg = "❌ Chat failed. Please try again.";
      
      if (errMsg.includes("abort") || errMsg.includes("timeout") || errMsg.includes("AbortSignal")) {
        if ((activeSettings.provider || "").endsWith("_web")) {
          replyMsg = `Creator Bridge ${activeSettings.provider} timed out while waiting for response.`;
        } else {
          replyMsg = "Chat timed out. Please try again.";
        }
      }
      
      console.error("[pantheon-tg] /v1/chat text handler failed", errMsg);
      await ctx.reply(replyMsg);
    }
  });

  bot.action("action_repeat", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
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
            selected_provider: lastResponse.provider,
            bridge_enabled: false,
            creator_mode: label === "★" || label === "★★",
            chat_id: chatIdStr,
            from: uid,
            action: "repeat",
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as any;
      const output = String(data?.output || data?.reply || data?.answer || "").trim();

      if (output) {
        await ctx.reply(output);
        await saveActionResponse(chatIdStr, uid, lastResponse.message, output, lastResponse.provider, data?.request_id || String(Date.now()));
      } else {
        await ctx.reply(lang === "ru" ? "❌ Повтор не удался" : "❌ Repeat failed");
      }

      await logAction(chatIdStr, uid, label, "repeat", output ? "completed" : "failed");
    } catch (e: any) {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      console.error("[telegram-action] action_repeat failed", e?.message || e);
      await logAction(chatIdStr, uid, label, "repeat", "failed", e?.message);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_clarify", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram-action] action_clarify clicked", { user_id: uid, chat_id: chatIdStr, label });

      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }

      await ctx.answerCbQuery(lang === "ru" ? "Уточняю..." : "Clarifying...");

      const clarifyPrompt = lang === "ru"
        ? `Уточни и сделай понятнее след��ющий ответ:\n\n${lastResponse.response_text}`
        : `Make the following answer clearer and more concise:\n\n${lastResponse.response_text}`;

      const res = await fetch("http://127.0.0.1:8787/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(65000),
        body: JSON.stringify({
          message: clarifyPrompt,
          model: providerToModel(lastResponse.provider as TelegramProvider),
          task: { type: "chat" },
          meta: {
            source: "telegram",
            telegram_user_id: uid,
            selected_provider: lastResponse.provider,
            bridge_enabled: false,
            creator_mode: label === "★" || label === "★★",
            chat_id: chatIdStr,
            from: uid,
            action: "clarify",
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as any;
      const output = String(data?.output || data?.reply || data?.answer || "").trim();

      if (output) {
        await ctx.reply(output);
      } else {
        await ctx.reply(lang === "ru" ? "❌ Уточнение не удалось" : "❌ Clarify failed");
      }

      await logAction(chatIdStr, uid, label, "clarify", output ? "completed" : "failed");
    } catch (e: any) {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      console.error("[telegram-action] action_clarify failed", e?.message || e);
      await logAction(chatIdStr, uid, label, "clarify", "failed", e?.message);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_file", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);

      console.log("[telegram-action] action_file clicked", { user_id: uid, chat_id: chatIdStr, label });

      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery("No previous response", { show_alert: true });
        return;
      }

      await ctx.answerCbQuery("Sending as file...");

      const filename = `response_${lastResponse.request_id}.txt`;
      const content = `# Response ${lastResponse.request_id}\n# Provider: ${lastResponse.provider}\n# Date: ${new Date(lastResponse.timestamp).toISOString()}\n\n${lastResponse.response_text}`;

      await ctx.replyWithDocument({
        source: Buffer.from(content, "utf-8"),
        filename,
      });

      await logAction(chatIdStr, uid, label, "file", "completed");
    } catch (e: any) {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      console.error("[telegram-action] action_file failed", e?.message || e);
      await logAction(chatIdStr, uid, label, "file", "failed", e?.message);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_read_aloud", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram-action] action_read_aloud clicked", { user_id: uid, chat_id: chatIdStr, label });

      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }

      await handleTTSOutput(ctx, chatIdStr, uid, lastResponse.response_text);
    } catch (e: any) {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      console.error("[telegram-action] action_read_aloud failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_image", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram-action] action_image clicked", { user_id: uid, chat_id: chatIdStr, label });

      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }

      await ctx.answerCbQuery(lang === "ru" ? "Генерирую..." : "Generating...");

      const result = await generateImage(ctx, uid, chatIdStr, "", lastResponse.response_text, true);

      if (result.success && result.urls) {
        await sendImageToTelegram(ctx, result.urls, lang);
        await ctx.reply(lang === "ru" ? "✅ Готово!" : "✅ Done!");
      } else {
        await ctx.reply(`❌ ${result.error || (lang === "ru" ? "Ошибка" : "Error")}`);
      }
    } catch (e: any) {
      console.error("[telegram-action] action_image failed", e?.message || e);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action("action_provider", async (ctx) => {
    await ctx.answerCbQuery("Open provider menu", { show_alert: true });
    const uid = String((ctx as any)?.from?.id || "");
    const role = getTelegramRole(uid);
    if (role === "owner" || role === "partner") {
      await ctx.reply("🧠 Select provider:", compactMenuKeyboard(role));
    }
  });

  bot.action("action_save", async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      const username = String((ctx as any)?.from?.username || "");
      const lang = detectLanguage(username);

      console.log("[telegram-action] action_save clicked", { user_id: uid, chat_id: chatIdStr, label });

      const lastResponse = await getLastResponse(chatIdStr, uid);
      if (!lastResponse) {
        await ctx.answerCbQuery(lang === "ru" ? "Нет предыдущего ответа" : "No previous response", { show_alert: true });
        return;
      }

      await ctx.answerCbQuery(lang === "ru" ? "Сохранено!" : "Saved!");
      await ctx.reply(lang === "ru" ? "✅ Ответ сохранён!" : "✅ Response saved!");

      await logAction(chatIdStr, uid, label, "save", "completed");
    } catch (e: any) {
      const uid = String((ctx as any)?.from?.id || "");
      const chatIdStr = String(chatId(ctx));
      const label = getAccountLabel(uid);
      console.error("[telegram-action] action_save failed", e?.message || e);
      await logAction(chatIdStr, uid, label, "save", "failed", e?.message);
      await ctx.answerCbQuery("Error: " + (e?.message || "unknown"), { show_alert: true });
    }
  });

  bot.action(/^brback:(\d+)$/i, async (ctx) => {
    try {
      const uid = String((ctx as any)?.from?.id || "");
      const priv = String((ctx as any)?.chat?.type || "") === "private";
      if (!isMaker(uid, priv)) return ctx.answerCbQuery(MSG.makerOnly, { show_alert: true });

      gcPending();
      const k = keyOf(ctx);
      const page = Number((ctx as any)?.match?.[1] || "1") || 1;
      const last = lastResultsListMsg.get(k);
      const pend = pendingSearch.get(k);
      const listMsgId =
        Number(last?.message_id || 0) ||
        Number(pend?.list_message_id || 0);
      const payload = renderBuildResultsPayload(page);

      await ctx.answerCbQuery("Back");
      if (listMsgId > 0) {
        await (ctx as any).telegram.editMessageText(
          (ctx as any).chat.id,
          listMsgId,
          undefined,
          payload.text,
          { reply_markup: (payload.keyboard as any).reply_markup }
        );
        lastResultsListMsg.set(k, { message_id: listMsgId, page, updated_at: Date.now() });
        return;
      }
      await (ctx as any).editMessageText(payload.text, {
        reply_markup: (payload.keyboard as any).reply_markup,
      });
    } catch {
      try {
        await ctx.answerCbQuery(MSG.error, { show_alert: true });
      } catch {}
    }
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  await bot.launch();
  console.log("[pantheon-tg] bot launched (polling)");

  return bot;
}

export async function startTelegramBotIfEnabled() {
  const enabled = process.env.TELEGPT_ENABLE_TELEGRAM_BOT === "1";
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!enabled || !token) return null;
  return startPantheonTelegramBot();
}
