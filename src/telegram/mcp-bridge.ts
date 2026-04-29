import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel } from "./bot.js";
import { isMaker } from "../intel/makerGate.js";
import path from "path";
import fs from "fs/promises";

const MCP_CONFIG_PATH = path.join(process.cwd(), "docs/mcp");
const KILO_CONFIG_PATH = path.join(process.env.HOME || "", ".config/kilo/kilo.jsonc");
const KILO_GATEWAY_PATH = path.join(process.env.HOME || "", "telegpt-mcp-gateway-v1/dist/index.js");
const MCP_LOG_FILE = path.join(process.cwd(), "data/telegram/mcp-audit.jsonl");

export interface MCPConfig {
  server_url: string;
  tools: string[];
  enabled: boolean;
  last_check?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  input_schema?: any;
}

export interface MCPHealthStatus {
  server_reachable: boolean;
  tools_count: number;
  tools: MCPTool[];
  latency_ms?: number;
  error?: string;
}

export interface KiloStatus {
  config_exists: boolean;
  gateway_exists: boolean;
  gateway_path: string;
  tools_count: number;
  last_error?: string;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(MCP_CONFIG_PATH, { recursive: true });
  } catch {}
}

export async function checkMCPHealth(url = "http://127.0.0.1:3000"): Promise<MCPHealthStatus> {
  const start = Date.now();

  try {
    const res = await fetch(`${url}/tools/list`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({}),
    });

    const latency = Date.now() - start;

    if (!res.ok) {
      return {
        server_reachable: false,
        tools_count: 0,
        tools: [],
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json().catch(() => ({}));
    const tools: MCPTool[] = Array.isArray(data?.tools) ? data.tools : [];

    return {
      server_reachable: true,
      tools_count: tools.length,
      tools,
      latency_ms: latency,
    };
  } catch (e: any) {
    return {
      server_reachable: false,
      tools_count: 0,
      tools: [],
      error: e?.message || "Connection failed",
    };
  }
}

export async function checkKiloStatus(): Promise<KiloStatus> {
  const status: KiloStatus = {
    config_exists: false,
    gateway_exists: false,
    gateway_path: KILO_GATEWAY_PATH,
    tools_count: 0,
  };

  try {
    const configStat = await fs.access(KILO_CONFIG_PATH).then(() => true).catch(() => false);
    status.config_exists = configStat;

    const gatewayStat = await fs.access(KILO_GATEWAY_PATH).then(() => true).catch(() => false);
    status.gateway_exists = gatewayStat;

    if (configStat) {
      const configContent = await fs.readFile(KILO_CONFIG_PATH, "utf-8").catch(() => "");
      const toolMatches = configContent.match(/"(\w+)_tool"/g);
      if (toolMatches) {
        status.tools_count = toolMatches.length;
      }
    }
  } catch (e: any) {
    status.last_error = e?.message;
  }

  return status;
}

export async function callMCPTool(
  tool: string,
  args: Record<string, any>,
  userId: string,
  label: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  const start = Date.now();
  const url = "http://127.0.0.1:3000";

  try {
    const res = await fetch(`${url}/tools/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        name: tool,
        arguments: args,
      }),
    });

    const duration = Date.now() - start;

    console.log("[mcp] tool executed", {
      tool,
      user_id: userId,
      label,
      duration_ms: duration,
      success: res.ok,
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const result = await res.json().catch(() => ({}));
    return { success: true, result };
  } catch (e: any) {
    console.error("[mcp] tool failed", { tool, error: e?.message });
    return { success: false, error: e?.message };
  }
}

export function formatMCPStatus(status: MCPHealthStatus, lang: Language = "ru"): string {
  const lines: string[] = [];

  if (!status.server_reachable) {
    lines.push(lang === "ru" ? "❌ MCP сервер недоступен" : "❌ MCP server unreachable");
  } else {
    lines.push(lang === "ru" ? "✅ MCP сервер онлайн" : "✅ MCP server online");
  }

  if (status.latency_ms) {
    lines.push(`${lang === "ru" ? "Задержка" : "Latency"}: ${status.latency_ms}ms`);
  }

  lines.push(`${lang === "ru" ? "Инструментов" : "Tools"}: ${status.tools_count}`);

  if (status.tools.length > 0) {
    lines.push(lang === "ru" ? "Доступные инструменты:" : "Available tools:");
    for (const tool of status.tools.slice(0, 10)) {
      lines.push(`• ${tool.name}`);
    }
    if (status.tools.length > 10) {
      lines.push(`... +${status.tools.length - 10} more`);
    }
  }

  if (status.error) {
    lines.push(`❌ ${status.error}`);
  }

  return lines.join("\n");
}

export function formatKiloStatus(status: KiloStatus, lang: Language = "ru"): string {
  const lines: string[] = [];

  lines.push(lang === "ru" ? "🧠 Kilo Code Status" : "🧠 Kilo Code Status");

  lines.push(`${lang === "ru" ? "Конфиг" : "Config"}: ${status.config_exists ? "✅" : "❌"}`);
  lines.push(`${lang === "ru" ? "Шлюз" : "Gateway"}: ${status.gateway_exists ? "✅" : "❌"}`);
  lines.push(`${lang === "ru" ? "Инструментов" : "Tools"}: ${status.tools_count}`);

  if (status.last_error) {
    lines.push(`❌ ${status.last_error}`);
  }

  if (status.gateway_path) {
    lines.push(`\nPath: ${status.gateway_path}`);
  }

  return lines.join("\n");
}

export function formatMCPTestResult(result: any, lang: Language = "ru"): string {
  if (!result) {
    return lang === "ru" ? "❌ Тест не пройден" : "❌ Test failed";
  }

  const lines = [
    lang === "ru" ? "✅ MCP тест пройден!" : "✅ MCP test passed!",
  ];

  if (result) {
    const preview = JSON.stringify(result).slice(0, 200);
    lines.push(`\n\`\`\`\n${preview}\n\`\`\``);
  }

  return lines.join("\n");
}

export const MCP_REQUIRED_TOOLS = [
  "telegpt_execute",
  "telegpt_health",
  "telegpt_read_file",
  "telegpt_workspace_status",
  "telegpt_patch_plan",
  "telegpt_patch_preview",
  "telegpt_apply_status",
];

export function checkRequiredTools(tools: MCPTool[]): { missing: string[]; present: string[] } {
  const toolNames = tools.map((t) => t.name);
  const present = toolNames.filter((name) => MCP_REQUIRED_TOOLS.includes(name));
  const missing = MCP_REQUIRED_TOOLS.filter((name) => !toolNames.includes(name));
  return { missing, present };
}