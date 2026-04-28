import { runSay, resolveAgentVoice } from "@/server/voice/sayCli";
import { sayWithFallback } from "@/lib/voice/sayWithFallback";
import { POST as speakPost } from "../speak/route";
import { makeTraceId, pickIncomingTraceId } from "@/lib/trace/traceId";
import { withTraceHeaders } from "@/lib/trace/withTraceHeaders";
import { writeVoiceTrace } from "@/server/voice/traceStore";
import { safeEnvSnapshot } from "@/server/voice/safeEnvSnapshot";

export const runtime = "nodejs";

type SayBody = {
  text: string;
  assistant_id?: string | null;
  speaker_id?: string | null;
  preset?: string | null;
  voice_id?: string | null;
  lang?: "ru" | "en" | "uz" | "auto";
};

export async function POST(req: Request) {
  const traceId = pickIncomingTraceId(req) ?? makeTraceId();
  const body = (await req.json().catch(() => ({}))) as SayBody;
  const text = String(body?.text ?? "").trim();
  if (!text) return Response.json({ ok: false, error: "missing_text" }, { status: 400 });

  const assistantId = body?.assistant_id ? String(body.assistant_id).trim() : null;
  const override = body?.speaker_id && body?.preset ? { speaker: body.speaker_id, preset: body.preset } : undefined;
  const cfg = resolveAgentVoice(assistantId, override);

  if (!cfg) {
    return Response.json({ ok: false, error: "missing_voice_config" }, { status: 400 });
  }

  return sayWithFallback(
    async () => {
      const { audio, metrics } = runSay({
        speaker: cfg.speaker,
        preset: cfg.preset,
        text,
        lang: body?.lang || "ru",
      });

      const headers: Record<string, string> = {
        "content-type": "audio/wav",
        "cache-control": "no-store",
        "x-telegpt-voice-provider": "local.say.cli",
        "x-telegpt-voice-route": "say",
        "x-telegpt-voice-preset": cfg.preset,
        "x-telegpt-voice-speaker": cfg.speaker,
        "x-telegpt-trace-id": traceId,
      };
      if (metrics.tts_ms !== undefined) headers["x-telegpt-tts-ms"] = String(metrics.tts_ms);
      if (metrics.dsp_ms !== undefined) headers["x-telegpt-dsp-ms"] = String(metrics.dsp_ms);
      if (metrics.rtf !== undefined) headers["x-telegpt-rtf"] = String(metrics.rtf);

      if (process.env.NODE_ENV !== "production") {
        console.info("[say] metrics", {
          trace_id: traceId,
          route: "say",
          speaker: cfg.speaker,
          preset: cfg.preset,
          tts_ms: metrics.tts_ms,
          dsp_ms: metrics.dsp_ms,
          rtf: metrics.rtf,
        });
      }

      await writeVoiceTrace({
        id: traceId,
        route: "say",
        preset: cfg.preset,
        speaker: cfg.speaker,
        tts_ms: metrics.tts_ms,
        dsp_ms: metrics.dsp_ms,
        rtf: metrics.rtf,
        failover_used: false,
      });

      return new Response(audio as unknown as BodyInit, { headers });
    },
    async () => {
      const headers = new Headers(req.headers);
      headers.set("content-type", "application/json");
      headers.set("x-telegpt-trace-id", traceId);
      const fallbackReq = new Request(req.url.replace("/say", "/speak"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          voice_id: body?.voice_id ?? null,
          lang_hint: body?.lang || "ru",
        }),
      });
      const res = await speakPost(fallbackReq);
      await writeVoiceTrace({
        id: traceId,
        route: "speak",
        preset: cfg.preset,
        speaker: cfg.speaker,
        failover_used: true,
        meta: {
          failover_reason: "say_unavailable_or_failed",
          env: safeEnvSnapshot(),
        },
      });
      return withTraceHeaders(res, traceId, { "x-telegpt-voice-route": "speak" });
    }
  );
}
