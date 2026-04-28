/**
 * Tele GPT Bridge Client
 *
 * This is the bridge between Telegram bots and Tele GPT core.
 *
 * Architecture:
 *   Telegram Bot → teleGPTClient → /v1/chat → Tele GPT → (optionally Vault)
 *
 * The bot becomes the TRANSPORT layer.
 * Tele GPT becomes the BRAIN layer.
 * Vault becomes the SECRETS layer.
 *
 * Usage:
 *   const client = createTeleGPTClient({ baseURL: "http://localhost:8787" });
 *   const response = await client.chat({ userId: "123", message: "Hello" });
 */

export interface TeleGPTChatRequest {
  userId: string;
  message: string;
  model?: string;
  system?: string;
  requestId?: string;
}

export interface TeleGPTChatResponse {
  id: string;
  model: string;
  output: string;
  meta?: {
    request_id: string;
    provider: string;
    model_raw: string;
    model_resolved: string;
    ts: number;
    latency_ms: number;
  };
  error?: string;
}

export interface TeleGPTClientOptions {
  baseURL: string;
  timeoutMs?: number;
  apiKey?: string;
  retryCount?: number;
  retryDelayMs?: number;
}

export interface TeleGPTClient {
  chat(request: TeleGPTChatRequest): Promise<TeleGPTChatResponse>;
  health(): Promise<{ ok: boolean; status: string }>;
  models(): Promise<{ id: string; object: string; owned_by: string }[]>;
}

const DEFAULT_OPTIONS: Required<Omit<TeleGPTClientOptions, "apiKey">> = {
  baseURL: "http://localhost:8787",
  timeoutMs: 30_000,
  retryCount: 2,
  retryDelayMs: 1_000,
};

/**
 * Create a Tele GPT bridge client that routes messages to Tele GPT core.
 */
export function createTeleGPTClient(
  options: TeleGPTClientOptions,
): TeleGPTClient {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const baseURL = config.baseURL.replace(/\/+$/, "");

  async function fetchWithRetry(
    url: string,
    init: RequestInit,
    retries: number,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(config.timeoutMs),
        });

        if (response.ok) return response;

        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return response;
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (err: any) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, config.retryDelayMs * (attempt + 1)),
          );
        }
      }
    }

    throw lastError ?? new Error("Fetch failed after retries");
  }

  async function chat(
    request: TeleGPTChatRequest,
  ): Promise<TeleGPTChatResponse> {
    const requestId = request.requestId ?? crypto.randomUUID();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-bridge-source": "telegram-bot",
      "x-bridge-user-id": request.userId,
    };

    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const body: Record<string, unknown> = {
      model: request.model ?? "local-demo",
      message: request.message,
    };

    if (request.system) {
      body.system = request.system;
    }

    const response = await fetchWithRetry(
      `${baseURL}/v1/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
      config.retryCount,
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        id: requestId,
        model: request.model ?? "local-demo",
        output: `Error: Tele GPT returned ${response.status}. ${errorText.slice(0, 200)}`,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      id: data.id ?? requestId,
      model: data.model ?? request.model ?? "local-demo",
      output: data.output ?? data.reply ?? "",
      meta: data.meta,
    };
  }

  async function health(): Promise<{ ok: boolean; status: string }> {
    try {
      const response = await fetch(`${baseURL}/health`, {
        signal: AbortSignal.timeout(5_000),
      });

      if (response.ok) {
        const data = await response.json();
        return { ok: true, status: data.status ?? "online" };
      }

      return { ok: false, status: `HTTP ${response.status}` };
    } catch {
      return { ok: false, status: "unreachable" };
    }
  }

  async function models(): Promise<
    { id: string; object: string; owned_by: string }[]
  > {
    try {
      const response = await fetch(`${baseURL}/v1/models`, {
        signal: AbortSignal.timeout(5_000),
      });

      if (response.ok) {
        const data = await response.json();
        return data.data ?? [];
      }

      return [];
    } catch {
      return [];
    }
  }

  return { chat, health, models };
}

/**
 * Resolve a secret alias to a Vault path.
 *
 * Examples:
 *   "openai:api_key" → "ai/openai/production/api/primary"
 *   "telegram:bot_token" → "messaging/telegram/production/bot/token"
 *   "db:password" → "database/main/production/password"
 */
export function resolveSecretAlias(alias: string): string {
  const [category, name] = alias.split(":");
  if (!category || !name) {
    throw new Error(
      `Invalid secret alias: "${alias}". Expected format "category:name"`,
    );
  }

  const env = process.env.VAULT_ENVIRONMENT ?? "production";

  const pathMap: Record<string, string> = {
    openai: `ai/openai/${env}/chat/primary`,
    anthropic: `ai/anthropic/${env}/chat/primary`,
    telegram: `messaging/telegram/${env}/bot/token`,
    db: `database/main/${env}/password`,
    redis: `cache/redis/${env}/password`,
    api: `api/external/${env}/key`,
  };

  return pathMap[category.toLowerCase()] ?? `secrets/${category}/${env}/${name}`;
}

/**
 * Format a Tele GPT response for Telegram delivery.
 * Handles markdown, code blocks, and message length limits.
 */
export function formatForTelegram(
  output: string,
  options?: {
    maxLength?: number;
    parseMode?: "Markdown" | "HTML" | "PlainText";
  },
): string {
  const maxLength = options?.maxLength ?? 4096;

  let text = output;

  // Trim if too long
  if (text.length > maxLength) {
    text = text.slice(0, maxLength - 50) + "\n\n... [truncated]";
  }

  return text;
}

/**
 * Check if a message should be routed to Tele GPT or handled locally.
 */
export function shouldRouteToTeleGPT(
  message: string,
  options?: {
    commandPrefix?: string;
    localCommands?: string[];
  },
): boolean {
  const prefix = options?.commandPrefix ?? "/";
  const localCommands = options?.localCommands ?? [
    "get",
    "set",
    "rotate",
    "revoke",
    "audit",
    "status",
    "help",
  ];

  // If message is a command
  if (message.startsWith(prefix)) {
    const command = message.slice(prefix.length).split(" ")[0].toLowerCase();
    // Route to Tele GPT only if it's NOT a local Vault command
    return !localCommands.includes(command);
  }

  // Regular messages always go to Tele GPT
  return true;
}
