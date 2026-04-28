import { createClient } from "@supabase/supabase-js";

export type VoiceTraceRow = {
  id: string;
  created_at: string;
  route: "say" | "speak";
  preset: string | null;
  speaker: string | null;
  tts_ms: number | null;
  dsp_ms: number | null;
  rtf: number | null;
  chunks: number | null;
  failover_used: boolean;
  meta: Record<string, any>;
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

export async function listVoiceTraces(limit = 50) {
  if (process.env.TELEGPT_VOICE_TRACE_DB !== "1") return [];
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("voice_traces")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, limit)));
  return (data ?? []) as VoiceTraceRow[];
}

export async function getVoiceTrace(id: string) {
  if (process.env.TELEGPT_VOICE_TRACE_DB !== "1") return null;
  const c = client();
  if (!c) return null;
  const { data } = await c
    .from("voice_traces")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as VoiceTraceRow | null;
}
