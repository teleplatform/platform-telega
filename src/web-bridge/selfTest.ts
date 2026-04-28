import { appendCreatorWebTrace } from "@/providers/creatorWebTraceWriter";
import { getCreatorWebProvider } from "@/providers/creatorWebRegistry";

export async function webTrace(
  provider_id: string,
  action_type: "open" | "send" | "wait" | "read" | "select",
  policy_verdict: "allowed" | "slow_mode" | "paused" | "blocked",
  meta: Record<string, any> = {},
  delay_applied_ms = 0
) {
  const p = getCreatorWebProvider(provider_id);
  const source_url = p?.source_url || "";
  const policy_id = p?.policy_id || "human_interaction_policy_v1";

  await appendCreatorWebTrace({
    provider_id,
    source_url,
    policy_id,
    action_type,
    delay_applied_ms,
    policy_verdict,
    meta,
  });
}
