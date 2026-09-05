/**
 * TGR-6.44 — Speech Style Engine
 * Transforms raw LLM text into a specific speech style before TTS.
 */

import { getSpeechStyle, SpeechStyleId } from "./speech-style-registry.js";

export interface SpeechStyleTransformRequest {
  text: string;
  styleId: SpeechStyleId;
  language: string;
  traceId: string;
}

export interface SpeechStyleTransformResult {
  originalText: string;
  transformedText: string;
  styleId: SpeechStyleId;
  success: boolean;
  error?: string;
  latencyMs: number;
}

export async function transformSpeechStyle(
  req: SpeechStyleTransformRequest
): Promise<SpeechStyleTransformResult> {
  const start = Date.now();
  const { text, styleId, language, traceId } = req;
  const style = getSpeechStyle(styleId);

  // If standard style, no transformation needed
  if (styleId === "standard" || !style.systemPrompt) {
    return {
      originalText: text,
      transformedText: text,
      styleId,
      success: true,
      latencyMs: Date.now() - start,
    };
  }

  try {
    // We use the internal chat API to perform the transformation.
    const res = await fetch("http://127.0.0.1:8787/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(30_000), // Style transformation should be fast
      body: JSON.stringify({
        message: text,
        model: "gpt-3.5-turbo", // Use a fast model for style transformation
        task: { type: "chat" },
        system_prompt: style.systemPrompt,
        meta: {
          source: "speech-style-engine",
          original_trace_id: traceId,
          style_id: styleId,
          language,
        },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as any;
    const transformedText = String(data?.output || data?.reply || data?.answer || "").trim();

    if (!transformedText) {
      throw new Error("Empty transformation result");
    }

    console.log("[speech-style-engine] success", {
      styleId,
      originalLen: text.length,
      transformedLen: transformedText.length,
      latencyMs: Date.now() - start,
    });

    return {
      originalText: text,
      transformedText,
      styleId,
      success: true,
      latencyMs: Date.now() - start,
    };
  } catch (e: any) {
    console.error("[speech-style-engine] failed", {
      styleId,
      error: e?.message,
      latencyMs: Date.now() - start,
    });

    // Fallback to original text if transformation fails
    return {
      originalText: text,
      transformedText: text,
      styleId,
      success: false,
      error: e?.message,
      latencyMs: Date.now() - start,
    };
  }
}
