/**
 * Vault Telegram Bot — Bridge to Tele GPT (Governed Runtime v12.x)
 *
 * Architecture:
 *   Telegram → Vault Bot → Governance Gate → Routing → Tele GPT Core → (Vault for secrets)
 *
 * Local Vault commands (handled by bot directly, independent of Tele GPT):
 *   /get, /set, /rotate, /revoke, /audit, /status, /help
 *
 * Intelligent queries (handled by Tele GPT with Vault context):
 *   "какой ключ сейчас основной для chat?"
 *   "покажи, что у нас есть для OpenAI"
 *   "какой fallback настроен для llm/chat/main?"
 *
 * Feature flags:
 *   TELEGPT_BRIDGE_ENABLED=true|false    — main switch for Tele GPT routing
 *   TELEGPT_BRIDGE_FAILOPEN_LOCAL=false  — if true, fallback to local mode when Tele GPT down
 */

import { Telegraf, Context } from "telegraf";
import {
  createTeleGPTClient,
  shouldRouteToTeleGPT,
  formatForTelegram,
  type TeleGPTClientOptions,
} from "../telegram/teleGPTBridge.js";
import {
  createVaultResolver,
  injectVaultSecrets,
  type VaultResolverOptions,
} from "../server/vaultResolver.js";

// ============================================================================
// Feature Flag Governance (V12.5)
// ============================================================================

export interface BridgeFeatureFlags {
  /** Main switch: route messages to Tele GPT */
  bridgeEnabled: boolean;
  /** If Tele GPT is down: fallback to local safe response vs error */
  failOpenLocal: boolean;
  /** Allow ${vault:...} injection in messages */
  allowVaultInjection: boolean;
}

function loadFeatureFlags(): BridgeFeatureFlags {
  return {
    bridgeEnabled: process.env.TELEGPT_BRIDGE_ENABLED !== "false",
    failOpenLocal: process.env.TELEGPT_BRIDGE_FAILOPEN_LOCAL === "true",
    allowVaultInjection: process.env.TELEGPT_BRIDGE_VAULT_INJECTION !== "false",
  };
}

// ============================================================================
// Runtime Governance Gate (V12.4)
// ============================================================================

export type VoiceMessageType =
  | "vault_command"
  | "ai_request"
  | "sensitive_request"
  | "health_query"
  | "unknown";

export interface VoiceRuntimeGovernanceGate {
  gateId: string;
  messageType: VoiceMessageType;
  allowed: boolean;
  requiredChecks: string[];
  reason?: string;
}

function classifyMessageType(message: string): VoiceMessageType {
  const lower = message.toLowerCase().trim();

  if (lower.startsWith("/")) return "vault_command";
  if (lower.includes("ключ") || lower.includes("secret") || lower.includes("token")) {
    return "sensitive_request";
  }
  if (lower.includes("статус") || lower.includes("status") || lower.includes("health")) {
    return "health_query";
  }
  return "ai_request";
}

function evaluateGovernanceGate(
  message: string,
  flags: BridgeFeatureFlags,
): VoiceRuntimeGovernanceGate {
  const messageType = classifyMessageType(message);
  const checks: string[] = [];
  let allowed = true;
  let reason: string | undefined;

  // Vault commands always pass — they don't need Tele GPT
  if (messageType === "vault_command") {
    return {
      gateId: `gate_${Date.now()}`,
      messageType,
      allowed: true,
      requiredChecks: ["vault_command_bypass"],
    };
  }

  // Health queries — allowed if bridge is enabled
  if (messageType === "health_query") {
    checks.push("health_query_allowed");
    return {
      gateId: `gate_${Date.now()}`,
      messageType,
      allowed: true,
      requiredChecks: checks,
    };
  }

  // Sensitive requests — check vault injection policy
  if (messageType === "sensitive_request") {
    checks.push("sensitive_request_review");
    if (!flags.allowVaultInjection) {
      allowed = false;
      reason = "Vault injection is disabled for sensitive requests";
    }
    if (!flags.bridgeEnabled) {
      allowed = false;
      reason = "Bridge is disabled — sensitive requests require Tele GPT";
    }
  }

  // Normal AI requests — check bridge enabled
  if (messageType === "ai_request") {
    checks.push("bridge_enabled_check");
    if (!flags.bridgeEnabled) {
      allowed = false;
      reason = "Tele GPT bridge is disabled (TELEGPT_BRIDGE_ENABLED=false)";
    }
  }

  return {
    gateId: `gate_${Date.now()}`,
    messageType,
    allowed,
    requiredChecks: checks,
    reason,
  };
}

// ============================================================================
// Safe Routing & Failover (V12.6)
// ============================================================================

export type VoiceRoutingDecision =
  | "telegpt"
  | "local_fallback"
  | "blocked";

export interface VoiceRoutingResult {
  route: VoiceRoutingDecision;
  reason: string;
  gateResult: VoiceRuntimeGovernanceGate;
}

function makeRoutingDecision(
  gate: VoiceRuntimeGovernanceGate,
  flags: BridgeFeatureFlags,
  teleGPTHealthy: boolean,
): VoiceRoutingResult {
  // Vault commands → local (never needs Tele GPT)
  if (gate.messageType === "vault_command") {
    return {
      route: "local_fallback",
      reason: "Vault command — handled locally",
      gateResult: gate,
    };
  }

  // Health queries → local
  if (gate.messageType === "health_query") {
    return {
      route: "local_fallback",
      reason: "Health query — handled locally",
      gateResult: gate,
    };
  }

  // Gate blocked → blocked
  if (!gate.allowed) {
    return {
      route: "blocked",
      reason: gate.reason ?? "Governance gate denied",
      gateResult: gate,
    };
  }

  // Tele GPT healthy → route to Tele GPT
  if (teleGPTHealthy) {
    return {
      route: "telegpt",
      reason: "Bridge enabled and Tele GPT healthy",
      gateResult: gate,
    };
  }

  // Tele GPT down → failover
  if (flags.failOpenLocal) {
    return {
      route: "local_fallback",
      reason: "Tele GPT unavailable — falling back to local mode",
      gateResult: gate,
    };
  }

  // Tele GPT down, no failover → blocked
  return {
    route: "blocked",
    reason: "Tele GPT unavailable and fail-open is disabled",
    gateResult: gate,
  };
}

// ============================================================================
// Runtime Audit Trace (V12.8)
// ============================================================================

export interface VoiceRuntimeTrace {
  traceId: string;
  userId: string;
  message: string;
  routedTo: "telegpt" | "vault" | "local";
  resultStatus: "success" | "error" | "fallback";
  latencyMs?: number;
  gateId?: string;
  messageType?: VoiceMessageType;
  timestamp: number;
}

const _traceLog: VoiceRuntimeTrace[] = [];
const MAX_TRACE_ENTRIES = 500;

function recordTrace(trace: VoiceRuntimeTrace): void {
  _traceLog.unshift(trace);
  if (_traceLog.length > MAX_TRACE_ENTRIES) {
    _traceLog.pop();
  }
}

export function getRuntimeTraces(limit = 20): VoiceRuntimeTrace[] {
  return _traceLog.slice(0, limit);
}

export function clearRuntimeTraces(): void {
  _traceLog.length = 0;
}

// ============================================================================
// Configuration
// ============================================================================

export interface VaultBotConfig {
  telegramToken: string;
  teleGPT?: TeleGPTClientOptions;
  vault?: VaultResolverOptions;
  allowedUserIds?: string[];
  featureFlags?: BridgeFeatureFlags;
}

function loadConfigFromEnv(): VaultBotConfig {
  const telegramToken = process.env.VAULT_BOT_TELEGRAM_TOKEN ?? "";
  const teleGPTBaseURL = process.env.VAULT_BOT_TELEGPT_URL ?? "http://localhost:8787";
  const vaultBaseURL = process.env.VAULT_BOT_VAULT_URL ?? "http://localhost:8200";
  const allowedUserIdsRaw = process.env.VAULT_BOT_ALLOWED_USERS ?? "";

  return {
    telegramToken,
    teleGPT: {
      baseURL: teleGPTBaseURL,
      timeoutMs: 30_000,
      retryCount: 2,
      retryDelayMs: 1_000,
    },
    vault: {
      baseURL: vaultBaseURL,
      timeoutMs: 5_000,
      cacheTTL: 60_000,
    },
    allowedUserIds: allowedUserIdsRaw
      ? allowedUserIdsRaw.split(",").map((s) => s.trim())
      : undefined,
    featureFlags: loadFeatureFlags(),
  };
}

// ============================================================================
// Local command registry (independent of Tele GPT)
// ============================================================================

const LOCAL_VAULT_COMMANDS = new Set([
  "get",
  "set",
  "rotate",
  "revoke",
  "audit",
  "status",
  "help",
  "start",
]);

// ============================================================================
// Bot creation
// ============================================================================

export function createVaultBot(config?: VaultBotConfig) {
  const cfg = config ?? loadConfigFromEnv();

  if (!cfg.telegramToken) {
    throw new Error(
      "VAULT_BOT_TELEGRAM_TOKEN is required. Set it in environment or pass config.",
    );
  }

  const flags = cfg.featureFlags ?? loadFeatureFlags();

  // Create Tele GPT bridge client
  const teleGPTClient = createTeleGPTClient(cfg.teleGPT ?? {
    baseURL: "http://localhost:8787",
  });

  // Create Vault resolver
  const vaultResolver = cfg.vault
    ? createVaultResolver(cfg.vault)
    : null;

  // Create Telegraf bot
  const bot = new Telegraf<Context>(cfg.telegramToken);

  // Check user authorization
  function isAllowed(ctx: Context): boolean {
    if (!cfg.allowedUserIds || cfg.allowedUserIds.length === 0) {
      return true;
    }
    const userId = String(ctx.from?.id ?? "");
    return cfg.allowedUserIds.includes(userId);
  }

  // Track Tele GPT health state (cached)
  let teleGPTHealthCache = { ok: true, lastCheck: 0 };
  async function isTeleGPTHealthy(): Promise<boolean> {
    const now = Date.now();
    if (now - teleGPTHealthCache.lastCheck < 30_000) {
      return teleGPTHealthCache.ok;
    }
    try {
      const health = await teleGPTClient.health();
      teleGPTHealthCache = { ok: health.ok, lastCheck: now };
      return health.ok;
    } catch {
      teleGPTHealthCache = { ok: false, lastCheck: now };
      return false;
    }
  }

  // ─── Local Vault Commands (independent of Tele GPT) ───

  bot.command("start", (ctx) => {
    ctx.reply(
      "🔐 **Vault Bot — Tele GPT Bridge**\n\n" +
        "I'm connected to:\n" +
        "🧠 **Tele GPT** — for intelligence\n" +
        "🔐 **Vault** — for secrets\n\n" +
        "**Vault Commands:**\n" +
        "/get <key> — Get a secret\n" +
        "/status — Check connections\n" +
        "/help — Show help\n\n" +
        "**Intelligent Queries (via Tele GPT):**\n" +
        '• "какой ключ сейчас основной для chat?"\n' +
        '• "покажи, что у нас есть для OpenAI"\n' +
        '• "какой fallback настроен для llm/chat/main?"\n\n' +
        "Just send any message — I'll route it intelligently!",
      { parse_mode: "Markdown" },
    );
  });

  bot.command("help", (ctx) => {
    ctx.reply(
      "**Vault Bot Help**\n\n" +
        "🧠 **Tele GPT Bridge**\n" +
        (flags.bridgeEnabled
          ? "✅ Enabled — intelligent queries go to Tele GPT"
          : "❌ Disabled — intelligent queries blocked\n") +
        (flags.failOpenLocal
          ? "✅ Fail-open — falls back to local if Tele GPT down"
          : "❌ No fail-open — errors if Tele GPT down\n") +
        "**Vault Commands:**\n" +
        "/get <alias> — Get secret (e.g., /get openai:api_key)\n" +
        "/status — Check Tele GPT + Vault\n" +
        "/help — This help\n\n" +
        "**Intelligent queries via Tele GPT:**\n" +
        "Just type naturally — I understand context about Vault.",
      { parse_mode: "Markdown" },
    );
  });

  bot.command("status", async (ctx) => {
    const lines: string[] = ["📊 **Connection Status**\n"];

    // Feature flags
    lines.push(`🏛️ **Feature Flags:**`);
    lines.push(`  • Bridge: ${flags.bridgeEnabled ? "✅" : "❌"}`);
    lines.push(`  • Fail-open: ${flags.failOpenLocal ? "✅" : "❌"}`);
    lines.push(`  • Vault injection: ${flags.allowVaultInjection ? "✅" : "❌"}`);
    lines.push("");

    // Tele GPT
    try {
      const health = await teleGPTClient.health();
      lines.push(`🧠 Tele GPT: ${health.ok ? "✅ Online" : `❌ ${health.status}`}`);
      if (health.ok) {
        const models = await teleGPTClient.models();
        lines.push(`   Models: ${models.length} available`);
      }
    } catch {
      lines.push("🧠 Tele GPT: ❌ Unreachable");
    }

    // Vault
    if (vaultResolver) {
      const testResult = await vaultResolver.resolve("_health_check");
      lines.push(
        `🔐 Vault: ${testResult.found ? "✅ Connected" : `⚠️ ${testResult.error ?? "not configured"}`}`,
      );
    } else {
      lines.push("🔐 Vault: ⚠️ Not configured");
    }

    ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  });

  bot.command("get", async (ctx) => {
    if (!vaultResolver) {
      return ctx.reply("⚠️ Vault is not configured.");
    }

    const alias = ctx.message?.text?.split(" ").slice(1).join(" ").trim();
    if (!alias) {
      return ctx.reply("Usage: /get <alias>\nExample: /get openai:api_key");
    }

    const startMs = Date.now();
    const result = await vaultResolver.resolve(alias, String(ctx.from?.id));

    if (result.found && result.value) {
      const masked =
        result.value.length > 10
          ? `${result.value.slice(0, 4)}...${result.value.slice(-4)}`
          : "***";
      const replyText =
        `🔐 **Secret Found**\n\n` +
        `Alias: \`${alias}\`\n` +
        `Path: \`${result.path}\`\n` +
        `Value: \`${masked}\`\n` +
        `Cached: ${result.cached ? "Yes" : "No"}`;
      await ctx.reply(replyText, { parse_mode: "Markdown" });

      // Auto-delete after 30s
      setTimeout(async () => {
        try { await ctx.deleteMessage(); } catch { /* ignore */ }
      }, 30_000);

      recordTrace({
        traceId: `trace_${Date.now()}`,
        userId: String(ctx.from?.id),
        message: `/get ${alias}`,
        routedTo: "vault",
        resultStatus: "success",
        latencyMs: Date.now() - startMs,
        messageType: "vault_command",
        timestamp: Date.now(),
      });
    } else {
      await ctx.reply(
        `❌ **Secret Not Found**\n\n` +
        `Alias: \`${alias}\`\n` +
        `Error: ${result.error ?? "Unknown error"}`,
        { parse_mode: "Markdown" },
      );

      recordTrace({
        traceId: `trace_${Date.now()}`,
        userId: String(ctx.from?.id),
        message: `/get ${alias}`,
        routedTo: "vault",
        resultStatus: "error",
        latencyMs: Date.now() - startMs,
        messageType: "vault_command",
        timestamp: Date.now(),
      });
    }
  });

  bot.command("audit", (ctx) => {
    if (!vaultResolver) {
      return ctx.reply("⚠️ Vault is not configured.");
    }

    const log = vaultResolver.getAuditLog().slice(0, 10);

    if (log.length === 0) {
      return ctx.reply("📋 Audit log is empty.");
    }

    const lines = log.map(
      (entry, i) =>
        `${i + 1}. ${entry.alias} → ${entry.success ? "✅" : "❌"} (${new Date(entry.accessedAt).toLocaleTimeString()})`,
    );

    ctx.reply(
      "📋 **Recent Audit Log**\n\n" + lines.join("\n"),
      { parse_mode: "Markdown" },
    );
  });

  // ─── Main Handler: Governed Routing ───

  bot.on("text", async (ctx) => {
    if (!isAllowed(ctx)) {
      return ctx.reply("🚫 You are not authorized to use this bot.");
    }

    const text = ctx.message.text.trim();
    if (!text) return;

    const startMs = Date.now();
    const userId = String(ctx.from?.id);
    const traceId = `trace_${Date.now()}`;

    // Step 1: Evaluate governance gate
    const gate = evaluateGovernanceGate(text, flags);

    // Step 2: Determine routing
    const teleGPTHealthy = await isTeleGPTHealthy();
    const routing = makeRoutingDecision(gate, flags, teleGPTHealthy);

    console.log(
      JSON.stringify({
        event: "runtime_routing",
        trace_id: traceId,
        user_id: userId,
        gate_id: gate.gateId,
        message_type: gate.messageType,
        route: routing.route,
        reason: routing.reason,
      }),
    );

    // Handle routing decisions
    switch (routing.route) {
      case "blocked": {
        // Governance gate blocked — safe fallback
        recordTrace({
          traceId,
          userId,
          message: text,
          routedTo: "local",
          resultStatus: "fallback",
          latencyMs: Date.now() - startMs,
          gateId: gate.gateId,
          messageType: gate.messageType,
          timestamp: Date.now(),
        });

        if (flags.failOpenLocal && gate.messageType !== "vault_command") {
          return ctx.reply(
            "⚠️ Tele GPT bridge is currently restricted. " +
            "Vault commands (/get, /status, /audit) are still available.",
          );
        }
        return ctx.reply(`🚫 Request blocked: ${routing.reason}`);
      }

      case "local_fallback": {
        // Health queries or vault commands handled locally
        if (gate.messageType === "health_query") {
          const health = await teleGPTClient.health();
          recordTrace({
            traceId,
            userId,
            message: text,
            routedTo: "local",
            resultStatus: "success",
            latencyMs: Date.now() - startMs,
            gateId: gate.gateId,
            messageType: gate.messageType,
            timestamp: Date.now(),
          });

          return ctx.reply(
            `🧠 Tele GPT: ${health.ok ? "✅ Online" : "❌ Unreachable"}`,
          );
        }

        // Vault commands are already handled by specific handlers above
        return ctx.reply(
          "Unknown command. Use /help for available commands.",
        );
      }

      case "telegpt": {
        // Route to Tele GPT
        await ctx.sendChatAction("typing");

        // Inject vault secrets if needed and allowed
        let processedMessage = text;
        if (flags.allowVaultInjection && vaultResolver && text.includes("${vault:")) {
          const injection = await injectVaultSecrets(
            text,
            vaultResolver,
            userId,
          );
          processedMessage = injection.message;

          if (injection.errors.length > 0) {
            await ctx.reply(
              `⚠️ Some secrets could not be injected:\n${injection.errors.join("\n")}`,
            );
          }
        }

        // Send to Tele GPT
        try {
          const userName = ctx.from?.username ?? ctx.from?.first_name ?? userId;

          const response = await teleGPTClient.chat({
            userId,
            message: processedMessage,
            system:
              `You are Tele GPT, accessed via Telegram Vault Bot. ` +
              `User: ${userName} (ID: ${userId}). ` +
              `You have access to Vault secrets. ` +
              `If user asks about keys, configs, or Vault state, help them intelligently. ` +
              `Examples: "какой ключ основной для chat?", "что есть для OpenAI?".`,
          });

          if (response.error) {
            recordTrace({
              traceId,
              userId,
              message: text,
              routedTo: "telegpt",
              resultStatus: "error",
              latencyMs: Date.now() - startMs,
              gateId: gate.gateId,
              messageType: gate.messageType,
              timestamp: Date.now(),
            });
            return ctx.reply(`⚠️ Error: ${response.error}`);
          }

          const formattedOutput = formatForTelegram(response.output, {
            maxLength: 4096,
            parseMode: "PlainText",
          });

          recordTrace({
            traceId,
            userId,
            message: text,
            routedTo: "telegpt",
            resultStatus: "success",
            latencyMs: Date.now() - startMs,
            gateId: gate.gateId,
            messageType: gate.messageType,
            timestamp: Date.now(),
          });

          await ctx.reply(formattedOutput);
        } catch (err: any) {
          console.error("[vault-bot] Tele GPT error:", err?.message ?? String(err));

          // Failover if enabled
          if (flags.failOpenLocal) {
            recordTrace({
              traceId,
              userId,
              message: text,
              routedTo: "local",
              resultStatus: "fallback",
              latencyMs: Date.now() - startMs,
              gateId: gate.gateId,
              messageType: gate.messageType,
              timestamp: Date.now(),
            });

            return ctx.reply(
              "⚠️ Tele GPT is temporarily unavailable. " +
              "Vault commands (/get, /status, /audit) still work.",
            );
          }

          recordTrace({
            traceId,
            userId,
            message: text,
            routedTo: "telegpt",
            resultStatus: "error",
            latencyMs: Date.now() - startMs,
            gateId: gate.gateId,
            messageType: gate.messageType,
            timestamp: Date.now(),
          });

          await ctx.reply(
            "⚠️ Tele GPT unavailable and fail-open is disabled.",
          );
        }
        break;
      }
    }
  });

  // Error handler
  bot.catch((err, ctx) => {
    console.error(
      `[vault-bot] Error for update ${ctx.update.update_id}:`,
      err,
    );
  });

  return {
    bot,
    teleGPTClient,
    vaultResolver,
    featureFlags: flags,
    getTraces: () => getRuntimeTraces(),
    launch: async () => {
      console.log("[vault-bot] Launching Telegram bot...");
      console.log(`[vault-bot] Bridge enabled: ${flags.bridgeEnabled}`);
      console.log(`[vault-bot] Fail-open: ${flags.failOpenLocal}`);
      console.log(`[vault-bot] Vault injection: ${flags.allowVaultInjection}`);
      await bot.launch();
      console.log("[vault-bot] Bot launched successfully.");

      process.once("SIGINT", () => bot.stop("SIGINT"));
      process.once("SIGTERM", () => bot.stop("SIGTERM"));
    },
  };
}

/**
 * Launch the vault bot with configuration from environment.
 */
export async function launchVaultBot(config?: VaultBotConfig) {
  const { launch } = createVaultBot(config);
  await launch();
  return { launched: true };
}
