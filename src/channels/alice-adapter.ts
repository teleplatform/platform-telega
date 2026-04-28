import type { FastifyInstance } from "fastify";
import type { UnifiedInboundEvent, UnifiedOutboundEvent, ChannelLogEvent } from "./unified-event.js";
import { shapeForAlice, getAliceFallback } from "./response-shaper.js";

const UPSTREAM_TIMEOUT_MS = 8000;
const ARISHA_TIMEOUT_MS = 65000;
const FALLBACK_UPSTREAM_UNAVAILABLE = "Не удалось связаться с ассистентом. Попробуйте позже.";
const FALLBACK_TIMEOUT = "Ассистент не успел ответить. Попробуйте ещё раз.";
const FALLBACK_INVALID_RESPONSE = "Получен некорректный ответ. Попробуйте позже.";
const FALLBACK_MALFORMED_INPUT = "Не понял запрос. Попробуйте переформулировать.";

function baseUrl(): string {
  return (process.env.TELEGPT_API_URL ?? "http://127.0.0.1:3333").replace(/\/$/, "");
}

function arishaBaseUrl(): string {
  const override = process.env.ARISHA_API_URL?.trim();
  if (override) return override.replace(/\/$/, "");
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

interface AliceWebhookPayload {
  meta: {
    client_id: string;
    message_id: string;
    session_id: string;
    user_id: string;
    application: {
      app_id: string;
    };
    locale: string;
  };
  request: {
    command: string;
    original_utterance: string;
    payloads?: Array<{
      type: string;
      payload: Record<string, unknown>;
    }>;
  };
}

function mapAliceToUnified(payload: AliceWebhookPayload): UnifiedInboundEvent | null {
  const text = payload.request.original_utterance || payload.request.command || "";
  const trimmed = text.trim();
  
  if (!trimmed) {
    return null;
  }
  
  const sessionKey = `alice:${payload.meta.user_id}:${payload.meta.session_id}`;
  
  return {
    channel: "alice",
    trace_id: `alice-${payload.meta.message_id}-${Date.now()}`,
    channel_user_id: payload.meta.user_id,
    channel_session_id: sessionKey,
    message_id: payload.meta.message_id,
    text: trimmed,
    locale: payload.meta.locale,
    raw_payload: payload as unknown as Record<string, unknown>,
    metadata: {
      client_id: payload.meta.client_id,
      application: payload.meta.application,
      command: payload.request.command,
      payloads: payload.request.payloads,
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
        channel: "alice",
        raw_input: { text: event.text },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      logStructured({
        event: "arisha_pipeline_failed",
        trace_id: event.trace_id,
        channel: "alice",
        adapter: "alice-adapter",
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
        channel: "alice",
        adapter: "alice-adapter",
        outcome: "failure",
        reason: "invalid_response_shape",
        duration_ms: durationMs,
      });
      return null;
    }

    const surfaceReply = (data.surface_reply ?? null) as Record<string, unknown> | null;
    const textOutput = (surfaceReply?.text_output ?? "") as string;
    const audioOutput = (surfaceReply?.audio_output ?? null) as Record<string, unknown> | null;
    const audioUrl = (surfaceReply?.audio_url ?? null) as string | null;
    const fallbackUsed = (surfaceReply?.fallback_used ?? true) as boolean;

    logStructured({
      event: "arisha_pipeline_succeeded",
      trace_id: event.trace_id,
      channel: "alice",
      adapter: "alice-adapter",
      outcome: "success",
      reason: `audio:${audioOutput !== null},fallback:${fallbackUsed}`,
      duration_ms: durationMs,
    });

    return {
      trace_id: event.trace_id,
      target_channel: "alice",
      response_type: "immediate",
      display_text: textOutput,
      speak_text: textOutput.length > 1024 ? textOutput.slice(0, 1021) + "..." : textOutput,
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
            channel: "alice",
            status: fallbackUsed ? "skipped" : "prepared",
            fallback_used: fallbackUsed,
          }
        : {
            attempted: false,
            channel: "alice",
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
      channel: "alice",
      adapter: "alice-adapter",
      outcome: "failure",
      reason: isTimeout ? "timeout" : err.message,
    });

    return null;
  }
}

async function callCore(event: UnifiedInboundEvent, startTime: number): Promise<UnifiedOutboundEvent> {
  // If Arisha is enabled, try the Arisha pipeline first
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
      channel: "alice",
      adapter: "alice-adapter",
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
        channel: "alice",
        adapter: "alice-adapter",
        outcome: "failure",
        reason: `HTTP ${res.status}`,
        duration_ms: durationMs,
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });
      return getAliceFallback("upstream_unavailable", event.trace_id);
    }

    const data = await res.json() as unknown;
    
    if (!data || typeof data !== "object") {
      logStructured({
        event: "upstream_response_invalid",
        trace_id: event.trace_id,
        channel: "alice",
        adapter: "alice-adapter",
        outcome: "failure",
        reason: "invalid_response_shape",
        duration_ms: durationMs,
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });
      return getAliceFallback("invalid_response", event.trace_id);
    }

    logStructured({
      event: "upstream_response_received",
      trace_id: event.trace_id,
      channel: "alice",
      adapter: "alice-adapter",
      outcome: "success",
      duration_ms: durationMs,
      message_id: event.message_id,
      session_key: event.channel_session_id,
    });

    return shapeForAlice(event, data);
  } catch (error) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    
    const err = error as Error;
    const isTimeout = err.name === "AbortError" || err.message.includes("abort");
    
    logStructured({
      event: isTimeout ? "upstream_request_timeout" : "upstream_request_failed",
      trace_id: event.trace_id,
      channel: "alice",
      adapter: "alice-adapter",
      outcome: "failure",
      reason: isTimeout ? "timeout" : err.message,
      duration_ms: durationMs,
      message_id: event.message_id,
      session_key: event.channel_session_id,
    });

    return getAliceFallback(isTimeout ? "timeout" : "upstream_unavailable", event.trace_id);
  }
}

function mapToAliceResponse(outbound: UnifiedOutboundEvent): Record<string, unknown> {
  const responseObj: Record<string, unknown> = {
    text: outbound.display_text || outbound.speak_text || "",
    tts: outbound.speak_text,
    end_session: outbound.end_session ?? false,
  };

  const response: Record<string, unknown> = {
    response: responseObj,
  };

  // If audio is available, add audio delivery metadata to Alice response
  if (outbound.audio_output?.filename) {
    responseObj.end_session = outbound.end_session ?? true;

    // Log audio delivery preparedness for Alice
    logStructured({
      event: "audio_delivery_attempt",
      trace_id: outbound.trace_id,
      channel: "alice",
      adapter: "alice-adapter",
      outcome: "success",
      reason: `audio_prepared:${outbound.audio_output.filename}`,
    });

    // Include audio metadata in response payload for downstream consumption
    // Alice protocol doesn't support direct audio file playback, but we include
    // TTS text from the generated audio context and metadata for logging
    if (outbound.audio_delivery) {
      (responseObj as any).audio_metadata = {
        provider: outbound.audio_output.provider,
        filename: outbound.audio_output.filename,
        size_bytes: outbound.audio_output.size_bytes,
        status: outbound.audio_delivery.status,
      };
    }
  }

  if (outbound.buttons && outbound.buttons.length > 0) {
    responseObj.buttons = outbound.buttons.map((btn) => ({
      text: btn.text,
      url: btn.url,
      payload: btn.callback_data,
    }));
  }

  if (outbound.handoff) {
    responseObj.text = outbound.display_text || "";
    responseObj.tts = outbound.speak_text;
    responseObj.end_session = false;
  }

  return response;
}

export async function registerAliceChannel(app: FastifyInstance) {
  app.post("/v1/channels/alice/webhook", async (req, reply) => {
    const startTime = Date.now();
    const body = req.body as unknown;

    if (!body || typeof body !== "object") {
      logStructured({
        event: "inbound_rejected",
        trace_id: "unknown",
        channel: "alice",
        adapter: "alice-adapter",
        outcome: "failure",
        reason: "malformed_payload",
      });
      return reply.status(400).send({
        response: {
          text: FALLBACK_MALFORMED_INPUT,
          tts: FALLBACK_MALFORMED_INPUT,
          end_session: false,
        },
      });
    }

    const payload = body as AliceWebhookPayload;
    
    try {
      const event = mapAliceToUnified(payload);
      
      if (!event) {
        logStructured({
          event: "inbound_rejected",
          trace_id: "unknown",
          channel: "alice",
          adapter: "alice-adapter",
          outcome: "ignored",
          reason: "empty_input",
        });
        return reply.send({
          response: {
            text: "",
            tts: "",
            end_session: false,
          },
        });
      }

      logStructured({
        event: "inbound_normalized",
        trace_id: event.trace_id,
        channel: "alice",
        adapter: "alice-adapter",
        outcome: "success",
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });

      const result = await callCore(event, startTime);
      
      logStructured({
        event: "outbound_shaped",
        trace_id: event.trace_id,
        channel: "alice",
        adapter: "alice-adapter",
        outcome: "success",
        duration_ms: Date.now() - startTime,
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });

      const aliceResponse = mapToAliceResponse(result);
      
      logStructured({
        event: "outbound_sent",
        trace_id: event.trace_id,
        channel: "alice",
        adapter: "alice-adapter",
        outcome: "success",
        duration_ms: Date.now() - startTime,
        message_id: event.message_id,
        session_key: event.channel_session_id,
      });
      
      return reply.send(aliceResponse);
    } catch (error) {
      console.error("[alice-adapter] error:", error);
      
      logStructured({
        event: "adapter_crash",
        trace_id: "unknown",
        channel: "alice",
        adapter: "alice-adapter",
        outcome: "failure",
        reason: "uncaught_exception",
        duration_ms: Date.now() - startTime,
      });
      
      return reply.status(500).send({
        response: {
          text: FALLBACK_UPSTREAM_UNAVAILABLE,
          tts: FALLBACK_UPSTREAM_UNAVAILABLE,
          end_session: false,
        },
      });
    }
  });

  app.get("/v1/channels/alice/health", async (_req, reply) => {
    const apiUrl = baseUrl();
    const hasApiUrl = Boolean(apiUrl);
    
    return reply.send({
      ok: true,
      channel: "alice",
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
