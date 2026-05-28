// @ts-nocheck — runtime-preserving extraction
import { Markup } from "telegraf";
import type { Telegraf } from "telegraf";
import { isMaker } from "../../intel/makerGate.js";
import { MSG } from '#i18n/messages';
import { detectLanguage } from "../../providers/creator/i18n.js";
import { buildReplyExtra, saveResponse as saveActionResponse, getLastResponse, logAction } from "../action-buttons.js";
import { handleVoiceInput, handleTTSOutput, toggleVoiceMode, getVoiceSettings, isVoiceModeEnabled, formatVoiceStatus, buildVoiceKeyboard } from "../voice-layer.js";
import { generateImage, sendImageToTelegram, getUserImages, formatUserImages, getImageCommands } from "../image-layer.js";
import { isIntelEnabled, isChatAllowed, setIntelEnabled } from "../../intel/intelGate.js";
import { loadIndex, listInboxJsonFiles, readIntelCardFile, saveIntelCard } from "../../intel/intelStore.js";
import { buildIntelCard } from "../../intel/intelParse.js";
import { runDigest, runDigestWeekly } from "../../intel/intelDigest.js";
import { writeBuildTaskFromPackCandidate, writeManualBuildTask } from "../../intel/buildTask.js";
import { countBuildTasks, listBuildTasks, readBuildTask } from "../../intel/buildTaskStore.js";
import { runOneBuildTask } from "../../intel/buildTaskWorker.js";
import { listBuildResultsFromIndex, getBuildResultsCount, findBuildResultsByPack, findTaskIdByTrace } from "../../intel/buildResultIndex.js";
import { traceExists } from "../../intel/traceWriter.js";
import { explainTrace, formatTraceExplainWithDiff, walkRetryChain, buildReasonHintForSingleTrace } from "../../intel/explainTrace.js";
import { retryBuildTask } from "../../intel/retryBuildTask.js";
import { checkMCPHealth, checkKiloStatus, callMCPTool, formatMCPStatus, formatKiloStatus, formatMCPTestResult, MCP_REQUIRED_TOOLS, checkRequiredTools } from "../mcp-bridge.js";
import { kiloPing, kiloWorkspace, kiloRead, kiloGrep, kiloStatus, KILO_READONLY_TOOLS, KILO_BLOCKED_TOOLS } from "../kilo-live.js";
import { createPatchPlan, previewPatch, applyPatch, verifyApply, rollbackApply, formatPatchList } from "../kilo-controlled-write.js";
import { createForgeTask, getForgeTask, updateForgeTask, listForgeTasks, handleForgeTask, formatForgeTask, formatForgeTaskList, canManageForgeTask } from "../forge-shell.js";
import { createWorkflow, getWorkflow, updateWorkflow, executeStage, skipStage, restartWorkflow, formatWorkflowVisualization, formatWorkflowList, listWorkflows, STAGES, WorkflowStage, validateGate, checkGates, formatValidationReport } from "../forge-workflow.js";
import { addTimelineEvent, getWorkflowTimeline, exportReport } from "../forge-timeline.js";
import { initGraphNode, getGraphNode, updateNodeStatus, checkDependencies, formatGraph, formatQueue, linkToParent } from "../forge-graph.js";
import { saveCheckpoint, getLatestCheckpoint, getWorkflowCheckpoints, pauseWorkflow, resumeWorkflow, recoverWorkflow, formatCheckpointList, formatRecoveryReport } from "../forge-checkpoints.js";
import { classifyFailure, createHealPlan, getHealPlan, getWorkflowHealPlans, updateHealPlanStatus, formatHealPlan, formatDiagnosis } from "../forge-heal.js";
import { buildWorkflowKeyboard, buildTimelineKeyboard, formatWorkflowCard, formatProgressBar, formatGraphCard, formatErrorCard, canUseControl, parseCallback } from "../forge-ui.js";
import { renderBuildResultsPayload, compactMenuKeyboard, providerLabel, showCompactMenu } from "../keyboards/telegram-keyboards.js";
import { deliverFullOutput } from "../../providers/creator/output-delivery.js";
import { pendingSearch, lastResultsListMsg, settingsOf, userRuntimeSettings, userLanguages, gcPending, getUserLang, setUserLang } from "../state/telegram-state.js";
import { keyOf, userIdOf, chatId, providerToModel, getTelegramRole, editOrReply } from "../utils/telegram-utils.js";
import fs from "fs";
import path from "path";

export type TelegramProvider =
  | "auto" | "openai_web" | "qwen_web" | "deepseek_web" | "kimi_web" | "ollama_local";
export type AccountLabel = "★" | "★★" | "★★★" | "";

export interface CommandHandlerContext {
  telegaRoot: string;
  PAGE_SIZE: number;
  getAccountLabel(uid: string | number | undefined): AccountLabel;
}

export function registerCoreCommands(bot: Telegraf, deps: CommandHandlerContext): void {
  console.log("[telegram:registerCoreCommands]");
  bot.command("start", async (ctx) => {
    console.log("[telegram:command:start]", {
      user_id: ctx.from?.id,
      chat_id: ctx.chat?.id,
    });
    await ctx.reply("✅ TeleGPT command layer alive");
  });

    bot.command("menu", async (ctx) => {
     return ctx.reply(
       "⚡ TeleGPT — Split Runtime",
       compactMenuKeyboard(getTelegramRole(userIdOf(ctx)))
     );
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

     bot.command("help", async (ctx) => {
   
       try {
   
         const uid = String((ctx as any)?.from?.id || "");
         const username = String((ctx as any)?.from?.username || "");
         const label = deps.getAccountLabel(uid);
         const lang = detectLanguage(username);
         const { renderAllCommands } = await import("../lib/commands.js");
   
         await ctx.reply(renderAllCommands(lang, label));
   
       } catch (e: any) {
   
         console.error("[telegram] /help failed", e?.message || e);
   
       }
   
     });
     
     bot.command("provider_current", async (ctx) => {
       try {
         const { getTelegramRole, userIdOf, settingsOf, editOrReply } = await import("../utils/telegram-utils.js");
         const { providerLabel, providerKeyboard } = await import("../keyboards/telegram-keyboards.js");
         const { ApiProviderRegistry, ApiProviderSwitcher, ApiProviderHealth, ApiProviderRenderer } = await import("../../runtime/provider/api/index.js");
         
         const userId = userIdOf(ctx);
         const role = getTelegramRole(userId);
         const settings = settingsOf(ctx);
         
         // For public users, show minimal information
         if (role === "public") {
           await ctx.reply("TeleGPT is ready.");
           return;
         }
         
         // For creator users, show detailed provider information
         const apiRegistry = new ApiProviderRegistry();
         const apiSwitcher = new ApiProviderSwitcher(apiRegistry);
         const apiHealth = new ApiProviderHealth(apiRegistry);
         const apiRenderer = new ApiProviderRenderer();
         
         // Get current provider status
         const currentProvider = settings.provider || "auto";
         const currentModel = settings.model || "";
         
         // Get provider health status
         let healthStatus = "unknown";
         let hasCredentials = false;
         
         // Map telegram provider to api provider for health check
         let apiProviderId: string | undefined;
         switch (currentProvider) {
           case "openai_web":
             apiProviderId = "openai:api";
             break;
           case "qwen_web":
             apiProviderId = "qwen:api";
             break;
           case "deepseek_web":
             apiProviderId = "deepseek:api";
             break;
           case "ollama_local":
             // Local provider - assume healthy if selected
             healthStatus = "healthy";
             hasCredentials = true;
             break;
           case "auto":
             // Auto mode - determine based on environment
             const llmProvider = (process.env.LLM_PROVIDER || "").toLowerCase();
             if (llmProvider === "ollama") {
               apiProviderId = "local"; // Special case for local
               healthStatus = "healthy";
               hasCredentials = true;
             } else {
               const localUrl = (process.env.LOCAL_OPENAI_BASE_URL || "").trim();
               const localModel = (process.env.LOCAL_OPENAI_MODEL || "").trim();
               if (localUrl && localModel) {
                 apiProviderId = "local";
                 healthStatus = "healthy";
                 hasCredentials = true;
               } else {
                 apiProviderId = "openai:api"; // Default to openai
               }
             }
             break;
           default:
             apiProviderId = undefined;
         }
         
         // Get health status for API providers
         if (apiProviderId && apiProviderId !== "local") {
           const status = await apiHealth.getProviderStatus(apiProviderId);
           if (status) {
             healthStatus = status.health;
             hasCredentials = status.has_credentials;
           }
         }
         
         const healthIcon = healthStatus === "healthy" ? "🟢" : 
                         healthStatus === "missing_credentials" ? "🟡" : 
                         healthStatus === "failed" ? "🔴" : "⚪";
         
         // Format mode
         let mode = "Auto";
         if (currentProvider === "ollama_local") mode = "Local";
         else if (["openai_web", "qwen_web", "deepseek_web", "kimi_web"].includes(currentProvider)) mode = "Web";
         else if (currentProvider === "auto") {
           // Determine actual mode for auto
           const llmProvider = (process.env.LLM_PROVIDER || "").toLowerCase();
           if (llmProvider === "ollama") mode = "Local";
           else {
             const localUrl = (process.env.LOCAL_OPENAI_BASE_URL || "").trim();
             const localModel = (process.env.LOCAL_OPENAI_MODEL || "").trim();
             if (localUrl && localModel) mode = "Local";
             else mode = "API";
           }
         }
         
         const lines = [
           "⚡ TeleGPT Provider Control",
           "",
           `**Mode:** ${mode}`,
           `**Active:** \`${providerLabel(currentProvider)}\``,
           `**Health:** ${healthIcon} ${healthStatus}`,
           "",
           settings.bridgeEnabled !== undefined || settings.creatorMode !== undefined ? 
             "**Web Bridge:**" : "",
           settings.bridgeEnabled !== undefined ? 
             `OpenAI: ${settings.bridgeEnabled ? "🟢" : "🔴"}` : "",
           settings.bridgeEnabled !== undefined ? 
             `Qwen: ${settings.bridgeEnabled ? "🟢" : "🔴"}` : "",
           settings.bridgeEnabled !== undefined ? 
             `DeepSeek: ${settings.bridgeEnabled ? "🟢" : "🔴"}` : "",
         ].filter(Boolean).join("\n");
         
         await ctx.reply(lines, { parse_mode: "Markdown" });
       } catch (e: any) {
         console.error("[telegram] /provider_current failed", e?.message || e);
         await ctx.reply("❌ Failed to get provider information");
       }
     });

    bot.command("commands", async (ctx) => {
  
      try {
  
        const uid = String((ctx as any)?.from?.id || "");
  
        const username = String((ctx as any)?.from?.username || "");
  
        const label = deps.getAccountLabel(uid);
  
        const lang = detectLanguage(username);
  
        const { renderForgeCommands, renderAllCommands } = await import("../lib/commands.js");
  
        const output = "⚡ FORGE COMMANDS\n\n" + renderForgeCommands(lang, label) + "\n\n📱 ALL COMMANDS\n\n" + renderAllCommands(lang, label);
  
        await ctx.reply(output);
  
      } catch (e: any) {
  
        console.error("[telegram] /commands failed", e?.message || e);
  
      }
  
    });

    bot.command("referral_link", async (ctx) => {
  
      try {
  
        const uid = String((ctx as any)?.from?.id || "");
  
        const { generateReferralLink } = await import("./growth-loop.js");
  
        const code = await generateReferralLink(uid);
  
        await ctx.reply(
  
          `🔗 REFERRAL LINK
  
          
  
  Share: /join ${code}
  
  
  
  Reward: 5% discount for referrer
  
  Get it: 5% Teleton for you`
  
        );
  
      } catch (e: any) {
  
        console.error("[referral_link] fail", e?.message);
  
        await ctx.reply("❌ " + e?.message);
  
      }
  
    });

}
