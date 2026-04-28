import { supabaseService } from "@/server/supabase/service";

export async function voiceAudit(params: {
  owner_user_id: string;
  actor_user_id: string;
  action: string;
  voice_id?: string | null;
  provider?: string | null;
  status?: "done" | "partial" | "blocked";
  ip?: string | null;
  user_agent?: string | null;
  meta?: Record<string, any>;
}) {
  const sb = supabaseService();
  await sb.from("voice_audit_log").insert({
    owner_user_id: params.owner_user_id,
    actor_user_id: params.actor_user_id,
    action: params.action,
    voice_id: params.voice_id ?? null,
    provider: params.provider ?? null,
    status: params.status ?? "done",
    ip: params.ip ?? null,
    user_agent: params.user_agent ?? null,
    meta: params.meta ?? {},
  });
}
