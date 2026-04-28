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
      await ctx.reply(usedFallback ? `⚠️ Fallback used\n\n${verbose}` : summary);
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

          const buttons = items.map((it, i) =>
            Markup.button.callback(`📦 #${i + 1} ${it.pack}`, `br:${it.id}`)
          );
          const rows: any[] = [];
          for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
          rows.push([Markup.button.callback("🗑 Clear", "brc:1")]);
          rows.push([Markup.button.callback(`↩️ Назад к результатам (стр. ${page})`, `brback:${page}`)]);

          await ctx.reply(
            `🔍 Найдено (топ ${items.length}) по \"${text}\"\n${lines.join("\n")}\n\nНажми чтобы открыть:`,
            Markup.inlineKeyboard(rows)
          );
          return;
        }
      }
    } catch {
      // ignore
    }
    const text = String((ctx as any)?.message?.text || "").trim();
    if (!text) return;
    if (text.startsWith("/")) return;

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

      await ctx.reply(output);
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
