import type { UnifiedInboundEvent, UnifiedOutboundEvent } from "./unified-event.js";

interface CoreResponse {
  status?: string;
  data?: {
    message?: string;
    result_frame?: {
      render_hints?: {
        max_detail_level?: string;
      };
    };
    [key: string]: unknown;
  };
  error?: {
    message?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ArishaPipelineResponse {
  ok?: boolean;
  trace_id?: string;
  channel?: string;
  surface_reply?: {
    text_output?: string;
    audio_output?: {
      asset_id: string;
      file_path?: string;
      filename?: string;
      mime?: string;
      size_bytes?: number;
      provider?: string;
      duration_ms?: number;
    };
    audio_url?: string;
    fallback_used?: boolean;
    payload_shape?: string;
  };
  response_trace?: unknown;
  errors?: Array<{ stage: string; message: string }>;
}

const MAX_TTS_LENGTH = 1024;
const ALICE_LONG_TEXT_THRESHOLD = 200;

const FALLBACK_MESSAGES = {
  upstream_unavailable: {
    display: "Не удалось связаться с ассистентом. Попробуйте позже.",
    speak: "Не удалось связаться с ассистентом. Попробуйте позже.",
  },
  timeout: {
    display: "Ассистент не успел ответить. Попробуйте ещё раз.",
    speak: "Ассистент не успел ответить. Попробуйте ещё раз.",
  },
  invalid_response: {
    display: "Получен некорректный ответ. Попробуйте позже.",
    speak: "Получен некорректный ответ. Попробуйте позже.",
  },
  malformed_input: {
    display: "Не понял запрос. Попробуйте переформулировать.",
    speak: "Не понял запрос. Попробуйте переформулировать.",
  },
};

type FallbackType = keyof typeof FALLBACK_MESSAGES;

function isArishaResponse(data: unknown): data is ArishaPipelineResponse {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.ok === "boolean" && typeof d.surface_reply === "object" && d.surface_reply !== null;
}

function isLongResponse(text: string, data: unknown): boolean {
  if (text.length > ALICE_LONG_TEXT_THRESHOLD) return true;
  
  const core = data as CoreResponse;
  if (core.status !== "ok") return false;
  
  const rf = core.data?.result_frame;
  if (!rf || typeof rf !== "object") return false;
  
  const hints = (rf as any).render_hints;
  if (!hints || typeof hints !== "object") return false;
  
  return (hints as any).max_detail_level === "full";
}

function stripMarkdown(text: string): string {
  return text
    .replace(/[*_~`>#]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateForTts(text: string, maxLength: number = MAX_TTS_LENGTH): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function getAliceFallback(type: FallbackType, traceId: string): UnifiedOutboundEvent {
  const fallback = FALLBACK_MESSAGES[type] || FALLBACK_MESSAGES.upstream_unavailable;
  
  return {
    trace_id: traceId,
    target_channel: "alice",
    response_type: "final",
    display_text: fallback.display,
    speak_text: fallback.speak,
  };
}

export function shapeForAlice(event: UnifiedInboundEvent, coreData: unknown): UnifiedOutboundEvent {
  const trace_id = event.trace_id;

  // Check if this is an Arisha pipeline response
  if (isArishaResponse(coreData)) {
    const arisha = coreData as ArishaPipelineResponse;
    const reply = arisha.surface_reply!;
    const text = reply.text_output || "";
    const audioOut = reply.audio_output ?? undefined;
    const audioUrl = reply.audio_url ?? undefined;
    const fallbackUsed = reply.fallback_used ?? false;

    return {
      trace_id,
      target_channel: "alice",
      response_type: "immediate",
      display_text: text,
      speak_text: text.length > MAX_TTS_LENGTH ? text.slice(0, MAX_TTS_LENGTH - 3) + "..." : text,
      audio_output: audioOut
        ? {
            ...audioOut,
            audio_url: audioUrl,
          }
        : undefined,
      audio_delivery: audioOut
        ? {
            attempted: true,
            channel: "alice",
            status: fallbackUsed ? "skipped" : "prepared",
            fallback_used: fallbackUsed,
          }
        : undefined,
    };
  }

  const core = coreData as CoreResponse;

  if (core.status !== "ok") {
    const errMsg = core.error?.message || "Ошибка обработки";
    return {
      trace_id,
      target_channel: "alice",
      response_type: "final",
      display_text: errMsg,
      speak_text: errMsg,
    };
  }

  const text = typeof core.data?.message === "string" 
    ? core.data.message 
    : JSON.stringify(core.data);

  const textNoMarkdown = stripMarkdown(text);
  const isLong = isLongResponse(textNoMarkdown, core);

  if (!isLong) {
    const ttsText = truncateForTts(textNoMarkdown);
    return {
      trace_id,
      target_channel: "alice",
      response_type: "immediate",
      display_text: textNoMarkdown,
      speak_text: ttsText,
    };
  }

  const summaryText = textNoMarkdown.slice(0, 200) + "...";
  const truncatedTts = truncateForTts(summaryText);
  const handoffMsg = "Ответ получился слишком длинным. Отправил подробности в T•G Messenger.";

  return {
    trace_id,
    target_channel: "alice",
    response_type: "handoff",
    display_text: handoffMsg,
    speak_text: truncateForTts(handoffMsg),
    handoff: {
      to_channel: "tgm",
      reason: "long_response",
    },
  };
}

export function getTelegramFallback(type: FallbackType, traceId: string): UnifiedOutboundEvent {
  const fallback = FALLBACK_MESSAGES[type] || FALLBACK_MESSAGES.upstream_unavailable;
  
  return {
    trace_id: traceId,
    target_channel: "telegram",
    response_type: "final",
    display_text: `⚠️ ${fallback.display}`,
  };
}

export function shapeForTelegram(event: UnifiedInboundEvent, coreData: unknown): UnifiedOutboundEvent {
  const trace_id = event.trace_id;

  // Check if this is an Arisha pipeline response
  if (isArishaResponse(coreData)) {
    const arisha = coreData as ArishaPipelineResponse;
    const reply = arisha.surface_reply!;
    const text = reply.text_output || "";
    const audioOut = reply.audio_output ?? undefined;
    const audioUrl = reply.audio_url ?? undefined;
    const fallbackUsed = reply.fallback_used ?? false;

    return {
      trace_id,
      target_channel: "telegram",
      response_type: "immediate",
      display_text: text,
      audio_output: audioOut
        ? {
            ...audioOut,
            audio_url: audioUrl,
          }
        : undefined,
      audio_delivery: audioOut
        ? {
            attempted: true,
            channel: "telegram",
            status: fallbackUsed ? "skipped" : "prepared",
            fallback_used: fallbackUsed,
          }
        : undefined,
    };
  }

  const core = coreData as CoreResponse;

  if (core.status !== "ok") {
    const errMsg = core.error?.message || "Ошибка обработки";
    return {
      trace_id,
      target_channel: "telegram",
      response_type: "final",
      display_text: `❌ ${errMsg}`,
    };
  }

  const text = typeof core.data?.message === "string"
    ? core.data.message
    : JSON.stringify(core.data);

  const textClean = stripMarkdown(text);

  return {
    trace_id,
    target_channel: "telegram",
    response_type: "immediate",
    display_text: textClean,
  };
}
