// ─────────────────────────────────────────────────────────────
// SIGMA FORGE LIVE INVOCATION PACK v1
//
// Live binding: Menu → ForgeBridge → Execution verification.
//
// Verifies:
// 1. owner presses Sigma Forge → ForgeBridge.run() invoked
// 2. task contract formed correctly
// 3. forge_remote target works
// 4. kilo_mcp target works
// 5. partner presses → blocked
// 6. public presses → blocked
// 7. blocked result → safe Telegram render
// 8. success result → safe Telegram render
// ─────────────────────────────────────────────────────────────

import {
  type ForgeTask,
  type ForgeResult,
  type ForgeTaskKind,
  type ForgeExecutionTarget,
  createForgeTask,
  createForgeResult,
} from "./forge-bridge.types.js";
import {
  assertForgeBridgeAllowed,
  resolveDefaultForgeTarget,
} from "./forge-bridge-policy.js";
import { getRuntimeRole } from "../../../core/auth/runtime-access.js";
import {
  createInvocationEvidence,
  updateInvocationEvidence,
  getInvocationEvidence,
} from "./forge-invocation-evidence.js";
import { buildForgeInvocationAuditLine } from "./forge-invocation-audit.js";
import { appendEvidenceToStore } from "./forge-evidence-store.js";

export interface ForgeLiveInvocationConfig {
  surface: "telegram" | "alice" | "web" | "api" | "bridge";
  executorFn?: (task: ForgeTask) => Promise<ForgeResult>;
}

export interface ForgeLiveInvocationResult {
  ok: boolean;
  taskId?: string;
  status: "done" | "blocked" | "error" | "failed" | "partial";
  summary: string;
  traceId?: string;
  error?: string;
}

let invocationConfig: ForgeLiveInvocationConfig | null = null;

export function initForgeLiveInvocation(cfg: ForgeLiveInvocationConfig): void {
  invocationConfig = cfg;
}

export function getForgeLiveConfig(): ForgeLiveInvocationConfig {
  if (!invocationConfig) {
    invocationConfig = { surface: "telegram" };
  }
  return invocationConfig;
}

export async function invokeForgeAction(params: {
  userId: string;
  chatId: string;
  action: "sigma_forge" | "forge_execute" | "forge_code";
  input?: string;
  kind?: ForgeTaskKind;
  target?: ForgeExecutionTarget;
}): Promise<ForgeLiveInvocationResult> {
  const { userId, chatId, action, input, kind, target } = params;
  const role = getRuntimeRole(userId);

  const taskKind = kind || "generic";
  const resolvedTarget = target || resolveDefaultForgeTarget(userId);
  const taskId = `forge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const invocationId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();

  const adapter = resolvedTarget === "forge_remote" ? "forge_http" : "kilo_mcp";

  const evidence = createInvocationEvidence({
    invocationId,
    taskId,
    userId,
    role,
    chatId,
    action,
    target: resolvedTarget,
    kind: taskKind,
    adapter,
    status: "started",
    summary: "Forge invocation started",
    startedAt,
  });

  appendEvidenceToStore(evidence).catch((e) => {
    console.error(`[evidence-store] failed to persist:`, e.message);
  });

  console.log(`[forge-live] action=${action} user=${userId} role=${role} target=${resolvedTarget}`);

  try {
    assertForgeBridgeAllowed(userId);
  } catch (blockError) {
    const blockedText = "⛔ Sigma Forge доступен только для создателей.";
    
    updateInvocationEvidence(invocationId, {
      status: "blocked",
      blockedReason: "forge_access_forbidden",
      summary: "Forge access forbidden for your role",
      renderedText: blockedText,
      finishedAt: new Date().toISOString(),
    });

    const blockedRecord = getInvocationEvidence(invocationId);
    if (blockedRecord) {
      appendEvidenceToStore(blockedRecord).catch((e) => {
        console.error(`[evidence-store] failed to persist blocked:`, e.message);
      });
      console.log(`[audit] ${buildForgeInvocationAuditLine(blockedRecord)}`);
    }

    console.log(`[forge-live] blocked: ${userId} role=${role}`);
    return {
      ok: false,
      taskId,
      status: "blocked",
      summary: "Forge access forbidden for your role",
      error: "access_denied",
    };
  }

  try {
    const task = createForgeTask({
      taskId,
      userId,
      role,
      target: resolvedTarget,
      kind: taskKind,
      input: input ? { prompt: input } : undefined,
    });

    const config = getForgeLiveConfig();
    let result: ForgeResult;

    if (config.executorFn) {
      result = await config.executorFn(task);
    } else {
      result = createForgeResult({
        taskId,
        target: resolvedTarget,
        status: "done",
        summary: `Forge action ${action} queued`,
      });
    }

    const renderedText = formatForgeResultForTelegram({
      ok: result.status === "done",
      taskId: result.taskId,
      status: result.status,
      summary: result.summary,
      traceId: result.traceId,
    });

    updateInvocationEvidence(invocationId, {
      status: result.status,
      summary: result.summary,
      renderedText,
      traceId: result.traceId,
      finishedAt: new Date().toISOString(),
    });

    const doneRecord = getInvocationEvidence(invocationId);
    if (doneRecord) {
      appendEvidenceToStore(doneRecord).catch((e) => {
        console.error(`[evidence-store] failed to persist done:`, e.message);
      });
      console.log(`[audit] ${buildForgeInvocationAuditLine(doneRecord)}`);
    }

    console.log(`[forge-live] completed: ${result.status}`);

    return {
      ok: result.status === "done",
      taskId: result.taskId,
      status: result.status,
      summary: result.summary,
      traceId: result.traceId,
    };
  } catch (e: any) {
    const errorText = `⚠️ Forge ошибка: ${e.message}`;
    
    updateInvocationEvidence(invocationId, {
      status: "failed",
      errorCode: "EXECUTION_ERROR",
      errorMessage: e.message,
      summary: "Forge invocation failed",
      renderedText: errorText,
      finishedAt: new Date().toISOString(),
    });

    const failedRecord = getInvocationEvidence(invocationId);
    if (failedRecord) {
      appendEvidenceToStore(failedRecord).catch((err) => {
        console.error(`[evidence-store] failed to persist failed:`, err.message);
      });
      console.log(`[audit] ${buildForgeInvocationAuditLine(failedRecord)}`);
    }

    console.error(`[forge-live] error:`, e.message);
    return {
      ok: false,
      taskId,
      status: "error",
      summary: "Forge invocation failed",
      error: e.message,
    };
  }
}

export function formatForgeResultForTelegram(result: ForgeLiveInvocationResult): string {
  if (!result.ok) {
    if (result.error === "access_denied") {
      return "⛔ Sigma Forge доступен только для создателей.";
    }
    return `⚠️ Forge ошибка: ${result.summary}`;
  }

  if (result.status === "blocked") {
    return `⛔ ${result.summary}`;
  }

  const traceLine = result.traceId ? `\n\n🆔 ${result.traceId}` : "";
  return `✅ ${result.summary}${traceLine}`;
}

export function buildForgeKeyboard(userId: string, role: string): any {
  const isOwner = role.startsWith("owner_");

  if (!isOwner) {
    return null;
  }

  return {
    inline_keyboard: [
      [
        { text: "🛠 Код", callback_data: "forge:code" },
        { text: "📁 Файл", callback_data: "forge:file" },
      ],
      [
        { text: "🔄 Повторить", callback_data: "forge:retry" },
        { text: "📜 Лог", callback_data: "forge:log" },
      ],
    ],
  };
}

export async function handleForgeCallback(params: {
  callbackData: string;
  userId: string;
  chatId: string;
}): Promise<ForgeLiveInvocationResult> {
  const { callbackData, userId, chatId } = params;

  if (!callbackData.startsWith("forge:")) {
    throw new Error("not_forge_callback");
  }

  const action = callbackData.replace("forge:", "") as "code" | "file" | "retry" | "log";

  switch (action) {
    case "code":
      return invokeForgeAction({
        userId,
        chatId,
        action: "forge_code",
        kind: "run_code",
      });

    case "file":
      return invokeForgeAction({
        userId,
        chatId,
        action: "forge_execute",
        kind: "create_file",
      });

    case "retry":
      return invokeForgeAction({
        userId,
        chatId,
        action: "forge_execute",
        kind: "generic",
      });

    case "log":
      return invokeForgeAction({
        userId,
        chatId,
        action: "forge_execute",
        kind: "generic",
      });

    default:
      return {
        ok: false,
        status: "error",
        summary: "Unknown forge action",
      };
  }
}

export async function handleForgeTextMessage(params: {
  text: string;
  userId: string;
  chatId: string;
}): Promise<ForgeLiveInvocationResult> {
  const { text, userId, chatId } = params;

  const lower = text.toLowerCase().trim();
  if (!lower.startsWith("/forge") && !lower.includes("sigma forge")) {
    throw new Error("not_forge_message");
  }

  return invokeForgeAction({
    userId,
    chatId,
    action: "forge_execute",
    kind: "generic",
    input: text,
  });
}