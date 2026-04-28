import fs from "fs";
import path from "path";
import { CreatorWebStateStore, ProviderStatus } from "./creatorWebStateStore";
import { RuntimeFlagsStore } from "./runtimeFlagsStore";
import { appendCreatorWebTrace } from "./creatorWebTraceWriter";

export type ActionType = "open" | "send" | "wait" | "read";

export type PolicyVerdict = "allowed" | "slow_mode" | "paused" | "blocked";

export interface ControlResult {
  allowed: boolean;
  delay_applied_ms: number;
  policy_verdict: PolicyVerdict;
  provider_status: ProviderStatus;
}

type CreatorWebProvider = {
  id: string;
  kind: "creator-web-automation";
  display_name: string;
  source_url: string;
  maker_only: boolean;
  enabled: boolean;
  policy_id: string;
};

type ProviderConfig = {
  providers: CreatorWebProvider[];
  rules?: {
    never_auto_select?: boolean;
    require_explicit_select?: boolean;
    no_parallel?: boolean;
  };
};

const BASE_DELAYS: Record<ActionType, number> = {
  open: 2000,
  send: 2500,
  read: 1500,
  wait: 3000,
};

const POLICY = {
  policy_id: "human_interaction_policy_v1",
  min_delay_ms_between_actions: 1500,
  min_delay_ms_after_page_load: 2000,
  min_delay_ms_after_send: 2500,
  max_actions_per_10min: 20,
  max_actions_per_day: 200,
  pause_minutes_on_limit: 60,
  near_limit_10m: 2,
  near_limit_day: 10,
};

const stateStore = new CreatorWebStateStore();
const flagsStore = new RuntimeFlagsStore();
let cachedConfig: ProviderConfig | null = null;

function getRepoRoot(): string {
  return process.cwd();
}

function configPath(): string {
  return path.join(getRepoRoot(), "config", "providers.creator-web.json");
}

function loadConfig(): ProviderConfig {
  if (cachedConfig) return cachedConfig;
  const raw = fs.readFileSync(configPath(), "utf8");
  const json = JSON.parse(raw) as ProviderConfig;
  cachedConfig = json;
  return json;
}

function getProvider(provider_id: string): CreatorWebProvider | null {
  const cfg = loadConfig();
  const p = cfg.providers.find((x) => x.id === provider_id);
  return p ?? null;
}

function delayFor(action: ActionType, verdict: PolicyVerdict): number {
  if (verdict === "allowed") return BASE_DELAYS[action];
  if (verdict === "slow_mode") return BASE_DELAYS[action] * 2;
  return 0;
}

export async function controlCreatorWebAction(input: {
  provider_id: string;
  action_type: ActionType;
  timestamp?: number;
}): Promise<ControlResult> {
  await stateStore.load();
  await flagsStore.load();
  const now = typeof input.timestamp === "number" ? input.timestamp : Date.now();
  const provider = getProvider(input.provider_id);
  const state = stateStore.unpauseIfExpired(input.provider_id, now);
  const runtimeKill = flagsStore.get().creator_web_automation_kill_switch;

  let verdict: PolicyVerdict;
  let status: ProviderStatus;

  if (state.relogin_required) {
    verdict = "blocked";
    status = "blocked";
    stateStore.setStatus(input.provider_id, "blocked", now);
  } else if (process.env.TELEGPT_CREATOR_WEB_AUTOMATION_KILL_SWITCH === "true" || runtimeKill) {
    verdict = "blocked";
    status = "blocked";
    stateStore.setStatus(input.provider_id, "blocked", now);
  } else if (process.env.TELEGPT_CREATOR_WEB_AUTOMATION_ENABLED !== "true") {
    verdict = "blocked";
    status = "blocked";
    stateStore.setStatus(input.provider_id, "blocked", now);
  } else if (!provider || !provider.enabled) {
    verdict = "blocked";
    status = "blocked";
    stateStore.setStatus(input.provider_id, "blocked", now);
  } else if (state.paused_until && now < state.paused_until) {
    verdict = "paused";
    status = "paused";
    stateStore.setStatus(input.provider_id, "paused", now);
  } else {
    const actions10m = state.actions_10m.length;
    const actionsDay = state.actions_day.length;

    if (actionsDay >= POLICY.max_actions_per_day) {
      stateStore.pause(input.provider_id, POLICY.pause_minutes_on_limit * 60 * 1000, now);
      verdict = "paused";
      status = "paused";
    } else {
      const near10m = actions10m >= POLICY.max_actions_per_10min - POLICY.near_limit_10m;
      const nearDay = actionsDay >= POLICY.max_actions_per_day - POLICY.near_limit_day;
      if (near10m || nearDay) {
        verdict = "slow_mode";
        status = "slow";
        stateStore.setStatus(input.provider_id, "slow", now);
      } else {
        verdict = "allowed";
        status = "normal";
        stateStore.setStatus(input.provider_id, "normal", now);
      }
    }
  }

  const delay = delayFor(input.action_type, verdict);
  const allowed = verdict === "allowed" || verdict === "slow_mode";

  const stateAfter = allowed
    ? stateStore.recordAction(input.provider_id, now)
    : stateStore.getSnapshot().providers[input.provider_id] || state;

  await appendCreatorWebTrace({
    provider_id: input.provider_id,
    source_url: provider?.source_url || "",
    policy_id: provider?.policy_id || POLICY.policy_id,
    usage_scope: "personal_internal",
    vendor_approval: "confirmed",
    action_type: input.action_type,
    delay_applied_ms: delay,
    policy_verdict: verdict,
    created_at: new Date(now).toISOString(),
    meta: {
      actions_10m: stateAfter.actions_10m.length,
      actions_day: stateAfter.actions_day.length,
      status,
    },
  });

  await stateStore.save();

  return {
    allowed,
    delay_applied_ms: delay,
    policy_verdict: verdict,
    provider_status: status,
  };
}

export function listCreatorWebProviders(): CreatorWebProvider[] {
  return loadConfig().providers;
}

export type { ProviderStatus };
