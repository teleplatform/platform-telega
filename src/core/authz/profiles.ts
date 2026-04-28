// Capability Profiles — Pack 2.2
// Mode-based capability profiles with budget/rate envelopes

import type {
  ActorMode,
  ActorRole,
  ActorId,
  Capability,
  CapabilityProfile,
  BudgetEnvelope,
  RateEnvelope,
} from "../../types/authz.js";

const BUDGET_BY_MODE: Record<ActorMode, BudgetEnvelope> = {
  public: {
    limit_usd: 1.0,
    max_tokens: 100_000,
    max_sessions_per_day: 50,
    max_steps_per_session: 5,
  },
  creator: {
    limit_usd: 10.0,
    max_tokens: 1_000_000,
    max_sessions_per_day: 500,
    max_steps_per_session: 20,
  },
  internal: {
    limit_usd: 100.0,
    max_tokens: 10_000_000,
    max_sessions_per_day: 5000,
    max_steps_per_session: 100,
  },
  system: {
    limit_usd: Infinity,
    max_tokens: Infinity,
    max_sessions_per_day: Infinity,
    max_steps_per_session: Infinity,
  },
};

const RATE_BY_MODE: Record<ActorMode, RateEnvelope> = {
  public: {
    max_requests_per_minute: 10,
    max_concurrent_sessions: 3,
    burst_limit: 5,
  },
  creator: {
    max_requests_per_minute: 60,
    max_concurrent_sessions: 10,
    burst_limit: 20,
  },
  internal: {
    max_requests_per_minute: 300,
    max_concurrent_sessions: 50,
    burst_limit: 100,
  },
  system: {
    max_requests_per_minute: Infinity,
    max_concurrent_sessions: Infinity,
    burst_limit: Infinity,
  },
};

const CAPABILITIES_BY_MODE: Record<ActorMode, Capability[]> = {
  public: [
    "run_agent",
    "create_task",
    "provider.local.use",
  ],
  creator: [
    "run_agent",
    "read_stream",
    "read_status",
    "verify_evidence",
    "read_evidence",
    "read_workspace",
    "write_workspace",
    "create_task",
    "read_task",
    "update_task",
    "read_artifact",
    "write_artifact",
    "use_provider",
    "invoke_tool",
    "provider.local.use",
    "provider.remote.use",
    "provider.creator.use",
    "tool.proxy.use",
    "tool.media.use",
    "tool.forge.use",
    "tool.research.use",
    "trace.read",
    "trace.explain.read",
  ],
  internal: [
    "run_agent",
    "read_stream",
    "read_status",
    "verify_evidence",
    "read_evidence",
    "read_workspace",
    "write_workspace",
    "execute_workspace",
    "create_task",
    "read_task",
    "update_task",
    "read_artifact",
    "write_artifact",
    "use_provider",
    "invoke_tool",
    "call_bridge_worker",
    "provider.local.use",
    "provider.remote.use",
    "provider.creator.use",
    "tool.proxy.use",
    "tool.media.use",
    "tool.forge.use",
    "tool.research.use",
    "trace.read",
    "trace.explain.read",
    "policy.override.internal",
  ],
  system: [
    "run_agent",
    "read_stream",
    "read_status",
    "verify_evidence",
    "read_evidence",
    "read_workspace",
    "write_workspace",
    "execute_workspace",
    "create_task",
    "read_task",
    "update_task",
    "read_artifact",
    "write_artifact",
    "use_provider",
    "invoke_tool",
    "call_bridge_worker",
    "provider.local.use",
    "provider.remote.use",
    "provider.creator.use",
    "tool.proxy.use",
    "tool.media.use",
    "tool.forge.use",
    "tool.research.use",
    "trace.read",
    "trace.explain.read",
    "policy.override.internal",
    "policy.override.system",
  ],
};

const PROVIDER_BY_MODE: Record<ActorMode, string[]> = {
  public: ["local"],
  creator: ["openai", "anthropic", "local"],
  internal: ["openai", "anthropic", "local", "*"],
  system: ["*"],
};

const TOOL_BY_MODE: Record<ActorMode, string[]> = {
  public: [],
  creator: ["fs.read", "net.fetch", "media.generate", "forge.run", "research.run"],
  internal: ["fs.read", "net.fetch", "media.generate", "forge.run", "research.run", "terminal.exec"],
  system: ["*"],
};

const FEATURE_FLAGS_BY_MODE: Record<ActorMode, Record<string, boolean>> = {
  public: {
    streaming: true,
    evidence_verify: false,
    workspace_execute: false,
    creator_lanes: false,
    trace_explain: false,
    tool_proxy: false,
  },
  creator: {
    streaming: true,
    evidence_verify: true,
    workspace_execute: true,
    creator_lanes: true,
    trace_explain: true,
    tool_proxy: true,
  },
  internal: {
    streaming: true,
    evidence_verify: true,
    workspace_execute: true,
    creator_lanes: true,
    trace_explain: true,
    tool_proxy: true,
  },
  system: {
    streaming: true,
    evidence_verify: true,
    workspace_execute: true,
    creator_lanes: true,
    trace_explain: true,
    tool_proxy: true,
  },
};

export function buildCapabilityProfile(
  actorId: ActorId,
  mode: ActorMode,
  role: ActorRole
): CapabilityProfile {
  return {
    actor_id: actorId,
    mode,
    role,
    capabilities: new Set(CAPABILITIES_BY_MODE[mode]),
    provider_access: [...PROVIDER_BY_MODE[mode]],
    tool_access: [...TOOL_BY_MODE[mode]],
    budget: { ...BUDGET_BY_MODE[mode] },
    rate: { ...RATE_BY_MODE[mode] },
    feature_flags: { ...FEATURE_FLAGS_BY_MODE[mode] },
  };
}

export function hasCapability(profile: CapabilityProfile, cap: Capability): boolean {
  return profile.capabilities.has(cap);
}

export function canAccessProvider(profile: CapabilityProfile, providerId: string): boolean {
  if (profile.provider_access.includes("*")) return true;
  return profile.provider_access.includes(providerId);
}

export function canInvokeTool(profile: CapabilityProfile, toolId: string): boolean {
  if (profile.tool_access.includes("*")) return true;
  return profile.tool_access.includes(toolId);
}

export function getBudgetForMode(mode: ActorMode): BudgetEnvelope {
  return { ...BUDGET_BY_MODE[mode] };
}

export function getRateForMode(mode: ActorMode): RateEnvelope {
  return { ...RATE_BY_MODE[mode] };
}
