import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel } from "./bot.js";
import { callMCPTool } from "./mcp-bridge.js";
import fs from "fs/promises";
import path from "path";

const EXECUTION_LOG = path.join(process.cwd(), "data/telegram/kilo-execution.jsonl");

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(EXECUTION_LOG), { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface KiloExecutionLog {
  execution_id: string;
  user_id: string;
  account_label: string;
  tool: string;
  args: Record<string, any>;
  status: "started" | "completed" | "failed" | "rejected";
  duration_ms?: number;
  error?: string;
  result_preview?: string;
  timestamp: number;
}

export async function logKiloExecution(
  userId: string,
  accountLabel: string,
  tool: string,
  args: Record<string, any>,
  status: KiloExecutionLog["status"],
  durationMs?: number,
  error?: string,
  result?: any
): Promise<void> {
  await ensureDir();

  const log: KiloExecutionLog = {
    execution_id: makeId("kexec"),
    user_id: userId,
    account_label: accountLabel,
    tool,
    args,
    status,
    duration_ms: durationMs,
    error,
    result_preview: result ? JSON.stringify(result).slice(0, 200) : undefined,
    timestamp: Date.now(),
  };

  try {
    const line = JSON.stringify(log) + "\n";
    await fs.appendFile(EXECUTION_LOG, line, "utf-8");
  } catch (e) {
    console.error("[kilo] log failed", e);
  }
}

export const KILO_READONLY_TOOLS = [
  "telegpt_health",
  "telegpt_read_file",
  "telegpt_workspace_status",
  "telegpt_patch_preview",
  "git_status",
  "git_log",
  "git_show",
];

export const KILO_BLOCKED_TOOLS = [
  "telegpt_execute",
  "telegpt_patch_apply",
  "git_commit",
  "git_push",
  "npm_install",
  "write_file",
];

export function isAllowedTool(tool: string): boolean {
  if (KILO_BLOCKED_TOOLS.includes(tool)) return false;
  return KILO_READONLY_TOOLS.includes(tool);
}

export function formatToolBlockedMessage(tool: string, lang: Language): string {
  return lang === "ru"
    ? `❌ Инструмент ${tool} заблокирован для read-only режима`
    : `❌ Tool ${tool} blocked in read-only mode`;
}

export async function kiloPing(
  userId: string,
  label: string,
  lang: Language
): Promise<string> {
  const start = Date.now();
  const tool = "telegpt_health";

  console.log("[kilo] ping", { user_id: userId, label });

  const result = await callMCPTool(tool, {}, userId, label);
  const duration = Date.now() - start;

  await logKiloExecution(userId, label, tool, {}, result.success ? "completed" : "failed", duration, result.error);

  if (result.success) {
    return lang === "ru"
      ? `✅ Kilo пингуется!\nЗадержка: ${duration}ms`
      : `✅ Kilo pings!\nLatency: ${duration}ms`;
  }

  return lang === "ru"
    ? `❌ Kilo недоступен: ${result.error}`
    : `❌ Kilo unreachable: ${result.error}`;
}

export async function kiloWorkspace(
  userId: string,
  label: string,
  lang: Language
): Promise<string> {
  console.log("[kilo] workspace", { user_id: userId, label });

  const result = await callMCPTool("telegpt_workspace_status", {}, userId, label);

  await logKiloExecution(
    userId,
    label,
    "telegpt_workspace_status",
    {},
    result.success ? "completed" : "failed",
    undefined,
    result.error
  );

  if (!result.success) {
    return lang === "ru"
      ? `❌ Ошибка: ${result.error}`
      : `❌ Error: ${result.error}`;
  }

  const lines = [
    lang === "ru" ? "📁 Workspace Status" : "📁 Workspace Status",
  ];

  if (result.result) {
    for (const [key, value] of Object.entries(result.result).slice(0, 10)) {
      lines.push(`• ${key}: ${JSON.stringify(value).slice(0, 50)}`);
    }
  }

  return lines.join("\n");
}

export async function kiloRead(
  userId: string,
  label: string,
  filePath: string,
  lang: Language
): Promise<string> {
  if (!filePath) {
    return lang === "ru"
      ? "Использование: /kilo_read <путь>\nПример: /kilo_read src/index.ts"
      : "Usage: /kilo_read <path>\nExample: /kilo_read src/index.ts";
  }

  console.log("[kilo] read", { user_id: userId, label, path: filePath });

  if (!isAllowedTool("telegpt_read_file")) {
    return formatToolBlockedMessage("telegpt_read_file", lang);
  }

  const result = await callMCPTool(
    "telegpt_read_file",
    { path: filePath },
    userId,
    label
  );

  await logKiloExecution(
    userId,
    label,
    "telegpt_read_file",
    { path: filePath },
    result.success ? "completed" : "failed",
    undefined,
    result.error,
    result.result
  );

  if (!result.success) {
    return lang === "ru"
      ? `❌ Ошибка чтения: ${result.error}`
      : `❌ Read error: ${result.error}`;
  }

  const content = result.result?.content || result.result || "";
  const preview = content.slice(0, 1000);

  return `\`\`\`\n${preview}\n\`\`\``;
}

export async function kiloGrep(
  userId: string,
  label: string,
  pattern: string,
  lang: Language,
  options?: { path?: string; caseSensitive?: boolean }
): Promise<string> {
  if (!pattern) {
    return lang === "ru"
      ? "Использование: /kilo_grep <pattern> [path]\nПример: /kilo_grep function"
      : "Usage: /kilo_grep <pattern> [path]\nExample: /kilo_grep function";
  }

  console.log("[kilo] grep", { user_id: userId, label, pattern });

  const args = {
    pattern,
    path: options?.path || ".",
    case_sensitive: options?.caseSensitive ?? false,
  };

  const result = await callMCPTool("telegpt_grep", args, userId, label);

  await logKiloExecution(
    userId,
    label,
    "telegpt_grep",
    args,
    result.success ? "completed" : "failed",
    undefined,
    result.error,
    result.result
  );

  if (!result.success) {
    return lang === "ru"
      ? `❌ Ошибка поиска: ${result.error}`
      : `❌ Search error: ${result.error}`;
  }

  const matches = result.result?.matches || [];
  const lines = [
    lang === "ru"
      ? `🔍 Найдено: ${matches.length} совпадений`
      : `🔍 Found: ${matches.length} matches`,
  ];

  for (const match of matches.slice(0, 20)) {
    const file = match.file || match.path || "";
    const lineNum = match.line || match.line_number || "";
    const text = (match.text || match.content || "").slice(0, 80);
    lines.push(`${file}:${lineNum} ${text}`);
  }

  if (matches.length > 20) {
    lines.push(lang === "ru"
      ? `... +${matches.length - 20} ещё`
      : `... +${matches.length - 20} more`);
  }

  return lines.join("\n");
}

export async function kiloStatus(
  userId: string,
  label: string,
  lang: Language
): Promise<string> {
  console.log("[kilo] status", { user_id: userId, label });

  const pingResult = await callMCPTool("telegpt_health", {}, userId, label);

  const lines = [
    "🧠 Kilo Live Status",
  ];

  if (pingResult.success) {
    lines.push("MCP: ✅ Online");
  } else {
    lines.push("MCP: ❌ Offline");
  }

  lines.push(`\n${lang === "ru" ? "Разрешённые инструменты" : "Allowed tools"}:`);
  for (const tool of KILO_READONLY_TOOLS) {
    lines.push(`• ${tool}`);
  }

  lines.push(`\n${lang === "ru" ? "Заблокированные инструменты" : "Blocked tools"}:`);
  for (const tool of KILO_BLOCKED_TOOLS) {
    lines.push(`• ${tool}`);
  }

  return lines.join("\n");
}