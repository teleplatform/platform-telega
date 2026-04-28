import { createClient } from "@supabase/supabase-js";

type VoiceTrace = {
  id: string;
  route: "say" | "speak";
  preset?: string | null;
  speaker?: string | null;
  tts_ms?: number;
  dsp_ms?: number;
  rtf?: number;
  chunks?: number;
  failover_used?: boolean;
  meta?: Record<string, any>;
};

let supa: ReturnType<typeof createClient> | null = null;
function client() {
  if (supa) return supa;
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  supa = createClient(url, key, { auth: { persistSession: false } });
  return supa;
}

export async function writeVoiceTrace(t: VoiceTrace) {
  if (process.env.TELEGPT_VOICE_TRACE_DB !== "1") return;
  const c = client();
  if (!c) return;
  try {
    await c.from("voice_traces").insert({
      id: t.id,
      route: t.route,
      preset: t.preset ?? null,
      speaker: t.speaker ?? null,
      tts_ms: t.tts_ms ?? null,
      dsp_ms: t.dsp_ms ?? null,
      rtf: t.rtf ?? null,
      chunks: t.chunks ?? null,
      failover_used: !!t.failover_used,
      meta: t.meta ?? {},
    });
  } catch {
    // trace store must not affect audio path
  }
}
