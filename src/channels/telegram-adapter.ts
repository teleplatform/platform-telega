import type { FastifyInstance } from "fastify";
import type { UnifiedInboundEvent, UnifiedOutboundEvent, ChannelLogEvent } from "./unified-event.js";
import { shapeForTelegram, getTelegramFallback } from "./response-shaper.js";
import { subjectToRole } from "../core/authz/actor.js";

const UPSTREAM_TIMEOUT_MS = 8000;
const ARISHA_TIMEOUT_MS = 65000;
const FALLBACK_UPSTREAM_UNAVAILABLE = "Не удалось связаться с ассистентом. Попробуйте позже.";
const FALLBACK_TIMEOUT = "Ассистент не успел ответить. Попробуйте ещё раз.";

function baseUrl(): string {
  return (process.env.TELEGPT_API_URL ?? "http://127.0.0.1:3333").replace(/\/$/, "");
}

function arishaBaseUrl(): string {
  const override = process.env.ARISHA_API_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  // Default: same server, port 8787
  return "http://127.0.0.1:8787";
}

function isArishaEnabled(): boolean {
  return (process.env.ARISHA_ENABLED ?? "false") === "true";
}

function logStructured(event: ChannelLogEvent): void {
  console.log(JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  }));
}

function resolveRole(kind: "telegram", userId: string): string {
  const creatorId = process.env.CREATOR_TELEGRAM_USER_ID;
  const allowedUsers = process.env.ALLOWED_TELEGRAM_USERS?.split(",").map(id => id.trim()).filter(Boolean) || [];
  
  if (userId === creatorId) return "creator";
  if (allowedUsers.includes(userId)) return "allowed";
  return subjectToRole(kind);
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: "private" | "group" | "supergroup" | "channel";
      title?: string;
    };
    text?: string;
  };
  edited_message?: unknown;
  callback_query?: unknown;
}

function extractCommand(text: string): string | null {
  if (!text || !text.startsWith("/")) return null;
  const parts = text.split(" ");
  return parts[0].toLowerCase();
}

function getTelegramSessionKey(msg: TelegramUpdate["message"], isGroup: boolean): string {
  const userId = msg?.from?.id ? String(msg.from.id) : "unknown";
  const chatId = msg?.chat?.id ? String(msg.chat.id) : "unknown";
  
  if (isGroup) {
    return `tg:group:${chatId}:${userId}`;
  }
  return `tg:private:${chatId}:${userId}`;
}

function shouldRespondInGroup(event: UnifiedInboundEvent): boolean {
  const meta = event.metadata;
  const text = event.text;
  
  if (!meta.is_group) return false;
  
  const command = extractCommand(text);
  if (command) return true;
  
  const mention = meta.command;
  if (mention && text.toLowerCase().includes(mention.toLowerCase())) return true;
  
  return false;
}

function mapTelegramToUnified(update: TelegramUpdate): UnifiedInboundEvent | null {
  const msg = update.message;
  if (!msg) return null;

  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
  const text = msg.text || "";
  const trimmed = text.trim();
  
  if (!trimmed) return null;

  if (isGroup) {
    const command = extractCommand(trimmed);
    const username = msg.from?.username || msg.from?.first_name || "bot";
    
    if (!command && !trimmed.toLowerCase().includes(username.toLowerCase())) {
      return null;
    }
    
    logStructured({
      event: "group_message_accepted",
      trace_id: `tg-${update.update_id}-${msg.message_id}`,
      channel: "telegram",
      adapter: "telegram-adapter",
      outcome: "success",
      reason: command ? "command" : "mention",
      message_id: String(msg.message_id),
      session_key: getTelegramSessionKey(msg, true),
    });
  }

  const sessionKey = getTelegramSessionKey(msg, isGroup);

  return {
    channel: "telegram",
    trace_id: `tg-${update.update_id}-${msg.message_id}`,
    channel_user_id: String(msg.from?.id || "unknown"),
    channel_session_id: sessionKey,
    message_id: String(msg.message_id),
    text: trimmed,
    raw_payload: update as unknown as Record<string, unknown>,
    metadata: {
      chat_id: String(msg.chat.id),
      user_first_name: msg.from?.first_name,
      is_group: isGroup,
      chat_type: msg.chat.type,
      username: msg.from?.username,
    },
  };
}

async function tryArishaPipeline(event: UnifiedInboundEvent, startTime: number): Promise<UnifiedOutboundEvent | null> {
  const url = `${arishaBaseUrl()}/v1/arisha/pipeline`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ARISHA_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trace_id: event.trace_id,
        session_id: event.channel_session_id || event.trace_id,
        actor_id: event.channel_user_id,
        actor_role: "creator",
        channel: "telegram",
        raw_input: { text: event.text },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      logStructured({
        event: "arisha_pipeline_failed",
        trace_id: event.trace_id,
        channel: "telegram",
        adapter: "telegram-adapter",
        outcome: "failure",
        reason: `HTTP ${res.status}`,
      });
      return null;
    }

    const data = await res.json() as Record<string, unknown>;
    const durationMs = Date.now() - startTime;

    if (!data || typeof data !== "object" || !data.ok) {
      logStructured({
        event: "arisha_pipeline_invalid",
        trace_id: event.trace_id,
        channel: "telegram",
        adapter: "telegram-adapter",
        outcome: "failure",
        reason: "invalid_response_shape",
        duration_ms: durationMs,
      });
      return null;
    }

    const surfaceReply = (data.surface_reply ?? null) as Record<string, unknown> | null;
    const responseTrace = (data.response_trace ?? null) as Record<string, unknown> | null;
    const textOutput = (surfaceReply?.text_output ?? "") as string;
    const audioOutput = (surfaceReply?.audio_output ?? null) as Record<string, unknown> | null;
    const audioUrl = (surfaceReply?.audio_url ?? null) as string | null;
    const fallbackUsed = (surfaceReply?.fallback_used ?? true) as boolean;

    logStructured({
      event: "arisha_pipeline_succeeded",
      trace_id: event.trace_id,
      channel: "telegram",
      adapter: "telegram-adapter",
      outcome: "success",
      reason: `audio:${audioOutput !== null},fallback:${fallbackUsed}`,
      duration_ms: durationMs,
    });

    return {
      trace_id: event.trace_id,
      target_channel: "telegram",
      response_type: "immediate",
      display_text: textOutput,
      audio_output: audioOutput
        ? {
            asset_id: String(audioOutput.asset_id ?? ""),
            file_path: typeof audioOutput.file_path === "string" ? audioOutput.file_path : undefined,
            filename: typeof audioOutput.filename === "string" ? audioOutput.filename : undefined,
            mime: typeof audioOutput.mime === "string" ? audioOutput.mime : undefined,
            size_bytes: typeof audioOutput.size_bytes === "number" ? audioOutput.size_bytes : undefined,
            provider: typeof audioOutput.provider === "string" ? audioOutput.provider : undefined,
            duration_ms: typeof audioOutput.duration_ms === "number" ? audioOutput.duration_ms : undefined,
            audio_url: audioUrl ?? undefined,
          }
        : undefined,
      audio_delivery: audioOutput
        ? {
            attempted: true,
            channel: "telegram",
            status: fallbackUsed ? "skipped" : "sent",
            fallback_used: fallbackUsed,
            outbound_method: fallbackUsed ? "sendMessage" : "sendVoice",
          }
        : {
            attempted: false,
            channel: "telegram",
            status: "skipped",
          },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const err = error as Error;
    const isTimeout = err.name === "AbortError" || err.message.includes("abort");

    logStructured({
      event: isTimeout ? "arisha_pipeline_timeout" : "arisha_pipeline_failed",
      trace_id: event.trace_id,
      channel: "telegram",
      adapter: "telegram-adapter",
      outcome: "failure",
      reason: isTimeout ? "timeout" : err.message,
    });

    return null;
  }
}

async function callCore(event: UnifiedInboundEvent, startTime: number): Promise<UnifiedOutboundEvent> {
  // If Arisha is enabled, try the Arisha pipeline first for voice-capable responses
  if (isArishaEnabled()) {
    const arishaResult = await tryArishaPipeline(event, startTime);
    if (arishaResult) return arishaResult;
  }

  // Fallback to legacy /chat path
  const url = `${baseUrl()}/chat`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    logStructured({
      event: "upstream_request_started",
      trace_id: event.trace_id,
      channel: "telegram",
      adapter: "telegram-adapter",
      outcome: "success",
      message_id: event.message_id,
      session_key: event.channel_session_id,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-trace-id": event.trace_id,
        "x-telegram-user-id": event.channel_user_id,
      },
      body: JSON.stringify({
        input: event.text,
        session_id: event.channel_session_id,
        mode: "public",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text();
      logStructured({
        event: "upstream_request_failed",
        trace_id: event.trace_id,
        channel: "telegram",
        adapter: "telegram-adapter",
        outcome: "failure",
        reason: `HTTP ${res.status}`,
        duration_ms: durationMs,
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });
      return getTelegramFallback("upstream_unavailable", event.trace_id);
    }

    const data = await res.json() as unknown;
    
    if (!data || typeof data !== "object") {
      logStructured({
        event: "upstream_response_invalid",
        trace_id: event.trace_id,
        channel: "telegram",
        adapter: "telegram-adapter",
        outcome: "failure",
        reason: "invalid_response_shape",
        duration_ms: durationMs,
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });
      return getTelegramFallback("invalid_response", event.trace_id);
    }

    logStructured({
      event: "upstream_response_received",
      trace_id: event.trace_id,
      channel: "telegram",
      adapter: "telegram-adapter",
      outcome: "success",
      duration_ms: durationMs,
      message_id: event.message_id,
      session_key: event.channel_session_id,
    });

    return shapeForTelegram(event, data);
  } catch (error) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    
    const err = error as Error;
    const isTimeout = err.name === "AbortError" || err.message.includes("abort");
    
    logStructured({
      event: isTimeout ? "upstream_request_timeout" : "upstream_request_failed",
      trace_id: event.trace_id,
      channel: "telegram",
      adapter: "telegram-adapter",
      outcome: "failure",
      reason: isTimeout ? "timeout" : err.message,
      duration_ms: durationMs,
      message_id: event.message_id,
      session_key: event.channel_session_id,
    });

    return getTelegramFallback(isTimeout ? "timeout" : "upstream_unavailable", event.trace_id);
  }
}

function mapToTelegramResponse(outbound: UnifiedOutboundEvent, chatId: string): Record<string, unknown> {
  // If audio is available and wasn't skipped by fallback, send as voice message
  const audioOut = outbound.audio_output;
  const audioDelivery = outbound.audio_delivery;
  const hasRealAudio = audioOut?.filename && audioDelivery?.status === "sent";

  if (hasRealAudio) {
    const audioFilename = audioOut.filename!;
    const audioUrl = audioOut.audio_url;
    const caption = outbound.display_text || "";

    logStructured({
      event: "audio_delivery_attempt",
      trace_id: outbound.trace_id,
      channel: "telegram",
      adapter: "telegram-adapter",
      outcome: "success",
      reason: `audio_available:${audioFilename}`,
    });

    return {
      method: "sendVoice",
      chat_id: chatId,
      voice: audioUrl || audioFilename,
      caption: caption.length > 1024 ? caption.slice(0, 1021) + "..." : caption,
    };
  }

  if (outbound.response_type === "final" || outbound.response_type === "immediate") {
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: outbound.display_text || "",
      parse_mode: undefined,
    };
  }

  if (outbound.response_type === "handoff") {
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: outbound.display_text || "Переключаю на другой канал...",
    };
  }

  return { ok: true };
}

export async function registerTelegramChannel(app: FastifyInstance) {
  app.post("/v1/channels/telegram/webhook", async (req, reply) => {
    const startTime = Date.now();
    const body = req.body as unknown;

    if (!body || typeof body !== "object") {
      logStructured({
        event: "inbound_rejected",
        trace_id: "unknown",
        channel: "telegram",
        adapter: "telegram-adapter",
        outcome: "failure",
        reason: "malformed_payload",
      });
      return reply.status(400).send({ error: "Invalid payload" });
    }

    const update = body as TelegramUpdate;

    const rawMessageFromId = (update.message as any)?.from?.id;
    const rawCallbackFromId = (update.callback_query as any)?.from?.id;
    const selectedUserId = String(rawMessageFromId ?? rawCallbackFromId ?? "unknown");
    console.log("[TELEGRAM-DEBUG] === WEBHOOK RECEIVED ===");
    console.log("[TELEGRAM-DEBUG] raw message.from.id:", rawMessageFromId, "typeof:", typeof rawMessageFromId);
    console.log("[TELEGRAM-DEBUG] raw callback_query.from.id:", rawCallbackFromId, "typeof:", typeof rawCallbackFromId);
    console.log("[TELEGRAM-DEBUG] selected userId for access check:", selectedUserId);
    console.log("[TELEGRAM-DEBUG] typeof selected userId:", typeof selectedUserId);
    
    try {
      const event = mapTelegramToUnified(update);
      
      if (!event) {
        logStructured({
          event: "group_message_ignored",
          trace_id: "unknown",
          channel: "telegram",
          adapter: "telegram-adapter",
          outcome: "ignored",
          reason: "no_mention_no_command",
        });
        return reply.send({ ok: true });
      }

      logStructured({
        event: "inbound_normalized",
        trace_id: event.trace_id,
        channel: "telegram",
        adapter: "telegram-adapter",
        outcome: "success",
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });

      console.log("[TELEGRAM-DEBUG] === ROLE RESOLUTION ===");
      console.log("[TELEGRAM-DEBUG] event.channel_user_id (userId for access):", event.channel_user_id, "typeof:", typeof event.channel_user_id);
      console.log("[TELEGRAM-DEBUG] resolveRole('telegram', userId):", resolveRole("telegram", event.channel_user_id));
      console.log("[TELEGRAM-DEBUG] Headers that will be sent to /chat:");
      console.log("[TELEGRAM-DEBUG]   x-telegram-user-id:", event.channel_user_id);
      console.log("[TELEGRAM-DEBUG]   x-trace-id:", event.trace_id);
      console.log("[TELEGRAM-DEBUG] config check - CREATOR_TELEGRAM_USER_ID:", process.env.CREATOR_TELEGRAM_USER_ID);
      console.log("[TELEGRAM-DEBUG] config check - ALLOWED_TELEGRAM_USERS:", process.env.ALLOWED_TELEGRAM_USERS);
      console.log("[TELEGRAM-DEBUG] Note: role 'telegram' -> subjectToRole() returns 'public' role");

      const result = await callCore(event, startTime);
      const chatId = event.metadata.chat_id || "unknown";
      
      logStructured({
        event: "outbound_shaped",
        trace_id: event.trace_id,
        channel: "telegram",
        adapter: "telegram-adapter",
        outcome: "success",
        duration_ms: Date.now() - startTime,
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });

      const tgResponse = mapToTelegramResponse(result, chatId);
      
      logStructured({
        event: "outbound_sent",
        trace_id: event.trace_id,
        channel: "telegram",
        adapter: "telegram-adapter",
        outcome: "success",
        duration_ms: Date.now() - startTime,
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });
      
      return reply.send(tgResponse);
    } catch (error) {
      console.error("[telegram-adapter] error:", error);
      
      logStructured({
        event: "adapter_crash",
        trace_id: "unknown",
        channel: "telegram",
        adapter: "telegram-adapter",
        outcome: "failure",
        reason: "uncaught_exception",
        duration_ms: Date.now() - startTime,
      });
      
      return reply.send({ ok: true });
    }
  });

  app.get("/v1/channels/telegram/health", async (_req, reply) => {
    const apiUrl = baseUrl();
    const hasApiUrl = Boolean(apiUrl);
    
    return reply.send({
      ok: true,
      channel: "telegram",
      status: "healthy",
      timestamp: new Date().toISOString(),
      details: {
        adapter_loaded: true,
        route_registered: true,
        upstream_configured: hasApiUrl,
      },
    });
  });
}
