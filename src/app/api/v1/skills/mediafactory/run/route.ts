import { NextResponse } from "next/server";
import { runMediaFactory } from "@/core/skills/mediafactory/runMediaFactory";
import { writeTrace } from "@/core/traces/writeTrace";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const stage = body?.stage as "Image" | "Video" | "Audio" | "Mux" | "Export" | undefined;
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  const maker_mode = Boolean(body?.maker_mode);

  if (!stage || !prompt) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const result = await runMediaFactory({
    stage,
    maker_mode,
    prompt,
    image_path: body?.image_path,
    video_path: body?.video_path,
    audio_path: body?.audio_path,
    captions_srt_path: body?.captions_srt_path,
    public_preset: body?.public_preset,
    maker: body?.maker,
  });

  const artifacts_count = Array.isArray(result.artifacts) ? result.artifacts.length : 0;
  const validators = result.validators ?? {};

  const trace_id = await writeTrace({
    ok: result.ok,
    route: "/v1/skills/mediafactory/run",
    provider: "local",
    lane: "skill",
    intent: "skill_run",
    intent_source: "skill",
    intent_reason: result.stage,
    fallback_used: false,
    failures_count: result.meta?.failures_count ?? 0,
    timeouts: result.meta?.timeouts ?? 0,
    skill_id: "mediafactory",
    skill_stage: result.stage,
    artifacts_count,
    maker_mode: result.meta?.maker_mode ?? false,
    duration_sec: result.meta?.duration_sec,
    validators_mp4_exists: validators.mp4_exists,
    validators_duration_ok: validators.duration_ok,
    validators_aspect_9x16: validators.aspect_9x16,
    validators_audio_present: validators.audio_present,
    meta: {
      prompt,
      stage,
      run_id: (result as any).run_id,
    },
  });

  return NextResponse.json({ ...result, trace_id });
}
