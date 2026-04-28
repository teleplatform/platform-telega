import { supabaseService } from "@/server/supabase/service";

function minuteBucketKey(prefix: string, userId: string) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const MI = String(d.getUTCMinutes()).padStart(2, "0");
  return `${prefix}:user:${userId}:${yyyy}-${mm}-${dd}T${HH}:${MI}Z`;
}

export async function voiceRateHit(opts: {
  userId: string;
  action: "clone" | "convert" | "dialogue";
  windowSeconds: number;
  limit: number;
}) {
  const sb = supabaseService();
  const key = minuteBucketKey(`voice:${opts.action}`, opts.userId);
  const { data, error } = await sb.rpc("voice_rate_hit", {
    p_key: key,
    p_window_seconds: opts.windowSeconds,
    p_limit: opts.limit,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: !!row?.allowed, count: Number(row?.new_count ?? 0), key };
}
