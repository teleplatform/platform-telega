import type { FastifyInstance } from "fastify";
import { runArishaPipeline } from "../../../apps/telegpt-api/src/arisha-orchestration/runArishaPipeline.js";
import type { AudioOutput } from "../../../apps/telegpt-api/src/arisha-orchestration/types.js";

function buildAudioUrl(audio: AudioOutput): string | undefined {
  if (!audio?.filename) return undefined;
  return `/v1/voice/files/${encodeURIComponent(audio.filename)}`;
}

export async function registerArishaRoute(app: FastifyInstance) {
  app.post("/v1/arisha/pipeline", async (req, reply) => {
    const body = req.body as any;

    if (!body?.raw_input?.text) {
      return reply.status(400).send({
        ok: false,
        error: "raw_input.text is required",
      });
    }

    try {
      const state = await runArishaPipeline({
        trace_id: body.trace_id || "unknown",
        session_id: body.session_id || "unknown",
        actor_id: body.actor_id || "unknown",
        actor_role: body.actor_role || "creator",
        channel: body.channel || "web",
        raw_input: { text: body.raw_input.text },
      });

      const surfaceReply = state.surface_reply ?? null;
      const audioOutput = surfaceReply?.audio_output ?? null;
      const audioUrl = audioOutput ? buildAudioUrl(audioOutput) : null;

      return reply.send({
        ok: true,
        trace_id: state.trace_id,
        session_id: state.session_id,
        channel: state.channel,
        input_text: body.raw_input.text,
        response_trace: state.response_trace ?? null,
        surface_reply: surfaceReply
          ? {
              ...surfaceReply,
              audio_url: audioUrl,
            }
          : null,
        errors: state.errors ?? [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown pipeline error";
      return reply.status(500).send({
        ok: false,
        trace_id: body.trace_id || "unknown",
        error: message,
      });
    }
  });
}
