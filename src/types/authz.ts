// AuthZ / Ownership Types — Pack 1
// Foundation for actor identity, ownership, permissions, and visibility

// ─── Actor Identity ───────────────────────────────────────────────────────

export type ActorId = string;
export type Subject = string;

export type ActorKind =
  | "telegram"
  | "api"
  | "user"
  | "maker"
  | "system"
  | "internal";

export type ActorRole =
  | "public"
  | "creator"
  | "internal"
  | "system";

export interface Actor {
  id: ActorId;
  kind: ActorKind;
  role: ActorRole;
  subject: Subject;
  isMaker: boolean;
  isSystem: boolean;
  isInternal: boolean;
}

// ─── Ownership ────────────────────────────────────────────────────────────

export type ResourceKind =
  | "session"
  | "workspace"
  | "evidence"
  | "task"
  | "artifact";

export interface OwnershipRecord {
  resource_kind: ResourceKind;
  resource_id: string;
  owner_id: ActorId;
  created_at: string;
  updated_at?: string;
}

export interface OwnershipClaim {
  resource_kind: ResourceKind;
  resource_id: string;
  actor_id: ActorId;
}

// ─── Visibility Scope ─────────────────────────────────────────────────────

export type VisibilityScope =
  | "private"
  | "shared"
  | "internal"
  | "public";

export interface VisibilityPolicy {
  scope: VisibilityScope;
  allowed_actors: ActorId[];
  allowed_roles: ActorRole[];
}

// ─── Permissions & Capabilities ───────────────────────────────────────────

export type Action =
  | "agent.run"
  | "agent.stream"
  | "agent.status"
  | "evidence.verify"
  | "evidence.read"
  | "workspace.read"
  | "workspace.write"
  | "task.create"
  | "task.read"
  | "task.update"
  | "artifact.read"
  | "artifact.write";

export type Capability =
  | "run_agent"
  | "read_stream"
  | "read_status"
  | "verify_evidence"
  | "read_evidence"
  | "read_workspace"
  | "write_workspace"
  | "execute_workspace"
  | "create_task"
  | "read_task"
  | "update_task"
  | "read_artifact"
  | "write_artifact"
  | "use_provider"
  | "invoke_tool"
  | "call_bridge_worker"
  | "provider.local.use"
  | "provider.remote.use"
  | "provider.creator.use"
  | "tool.proxy.use"
  | "tool.media.use"
  | "tool.forge.use"
  | "tool.research.use"
  | "trace.read"
  | "trace.explain.read"
  | "policy.override.internal"
  | "policy.override.system";

export interface CapabilityGrant {
  capability: Capability;
  conditions?: Record<string, unknown>;
}

export interface ActorProfile {
  actor_id: ActorId;
  role: ActorRole;
  capabilities: CapabilityGrant[];
  provider_access: string[];
  tool_access: string[];
  budget_limit_usd?: number;
  max_tokens?: number;
}

// ─── Permission Decision ──────────────────────────────────────────────────

export type PermissionDecision = "allow" | "deny" | "needs_approval";

export interface PermissionCheck {
  actor_id: ActorId;
  action: Action;
  resource_kind: ResourceKind;
  resource_id: string;
  decision: PermissionDecision;
  reason?: string;
  checked_at: string;
}

export interface DenyRecord {
  actor_id: ActorId;
  action: Action;
  resource_kind: ResourceKind;
  resource_id: string;
  reason: string;
  denied_at: string;
  trace_id?: string;
}

// ─── AuthZ Context (attached to request) ──────────────────────────────────

export interface AuthZContext {
  actor: Actor;
  profile: ActorProfile | null;
  visibility_policy: VisibilityPolicy | null;
}

// ─── Action → Ownership Check Matrix ──────────────────────────────────────

export interface ActionOwnershipRule {
  action: Action;
  allowed_roles: ActorRole[];
  requires_ownership: boolean;
  requires_capability?: Capability;
  system_override: boolean;
  internal_override: boolean;
}

export const DEFAULT_ACTION_RULES: ActionOwnershipRule[] = [
  {
    action: "agent.run",
    allowed_roles: ["public", "creator", "internal", "system"],
    requires_ownership: false,
    requires_capability: "run_agent",
    system_override: true,
    internal_override: true,
  },
  {
    action: "agent.stream",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "read_stream",
    system_override: true,
    internal_override: true,
  },
  {
    action: "agent.status",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "read_status",
    system_override: true,
    internal_override: true,
  },
  {
    action: "evidence.verify",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "verify_evidence",
    system_override: true,
    internal_override: true,
  },
  {
    action: "evidence.read",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "read_evidence",
    system_override: true,
    internal_override: true,
  },
  {
    action: "workspace.read",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "read_workspace",
    system_override: true,
    internal_override: true,
  },
  {
    action: "workspace.write",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "write_workspace",
    system_override: true,
    internal_override: true,
  },
  {
    action: "task.create",
    allowed_roles: ["public", "creator", "internal", "system"],
    requires_ownership: false,
    requires_capability: "create_task",
    system_override: true,
    internal_override: true,
  },
  {
    action: "task.read",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "read_task",
    system_override: true,
    internal_override: true,
  },
  {
    action: "task.update",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "update_task",
    system_override: true,
    internal_override: true,
  },
  {
    action: "artifact.read",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "read_artifact",
    system_override: true,
    internal_override: true,
  },
  {
    action: "artifact.write",
    allowed_roles: ["creator", "internal", "system"],
    requires_ownership: true,
    requires_capability: "write_artifact",
    system_override: true,
    internal_override: true,
  },
];

// ─── Role → Default Capabilities ──────────────────────────────────────────

export const ROLE_DEFAULT_CAPABILITIES: Record<ActorRole, Capability[]> = {
  public: [
    "run_agent",
    "create_task",
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
  ],
  internal: [
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
    "call_bridge_worker",
  ],
  system: [
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
    "call_bridge_worker",
  ],
};

// ─── Session Ownership (extends AgentSession) ─────────────────────────────

export interface SessionOwnership {
  sid: string;
  owner_id: ActorId;
  created_by: ActorId;
  visibility: VisibilityScope;
  created_at: string;
}

// ─── Workspace Ownership ──────────────────────────────────────────────────

export interface WorkspaceOwnership {
  workspace_id: string;
  owner_id: ActorId;
  allowed_actors: ActorId[];
  visibility: VisibilityScope;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pack 2 — Permission System + Creator Mode
// ═══════════════════════════════════════════════════════════════════════════

// ─── Actor Mode ────────────────────────────────────────────────────────────

export type ActorMode = "public" | "creator" | "internal" | "system";

export const MODE_PRECEDENCE: ActorMode[] = ["public", "creator", "internal", "system"];

export function modePrecedence(mode: ActorMode): number {
  return MODE_PRECEDENCE.indexOf(mode);
}

export function modeGte(a: ActorMode, b: ActorMode): boolean {
  return modePrecedence(a) >= modePrecedence(b);
}

// ─── Extended Capability Registry ─────────────────────────────────────────
// (Capability type already defined above with all Pack 2 extensions)

export type CapabilityGroup =
  | "agent"
  | "evidence"
  | "workspace"
  | "task"
  | "artifact"
  | "provider"
  | "tool"
  | "trace"
  | "policy";

export const CAPABILITY_GROUPS: Record<CapabilityGroup, Capability[]> = {
  agent: ["run_agent", "read_stream", "read_status"],
  evidence: ["verify_evidence", "read_evidence"],
  workspace: ["read_workspace", "write_workspace", "execute_workspace"],
  task: ["create_task", "read_task", "update_task"],
  artifact: ["read_artifact", "write_artifact"],
  provider: ["use_provider", "provider.local.use", "provider.remote.use", "provider.creator.use"],
  tool: ["invoke_tool", "tool.proxy.use", "tool.media.use", "tool.forge.use", "tool.research.use"],
  trace: ["trace.read", "trace.explain.read"],
  policy: ["call_bridge_worker", "policy.override.internal", "policy.override.system"],
};

// ─── Capability Profile ───────────────────────────────────────────────────

export interface CapabilityProfile {
  actor_id: ActorId;
  mode: ActorMode;
  role: ActorRole;
  capabilities: Set<Capability>;
  provider_access: string[];
  tool_access: string[];
  budget: BudgetEnvelope;
  rate: RateEnvelope;
  feature_flags: Record<string, boolean>;
}

// ─── Budget / Rate Envelopes ──────────────────────────────────────────────

export interface BudgetEnvelope {
  limit_usd: number;
  max_tokens: number;
  max_sessions_per_day: number;
  max_steps_per_session: number;
}

export interface RateEnvelope {
  max_requests_per_minute: number;
  max_concurrent_sessions: number;
  burst_limit: number;
}

// ─── Provider Access ──────────────────────────────────────────────────────

export interface ProviderAccessRule {
  provider_id: string;
  allowed_modes: ActorMode[];
  allowed_models?: string[];
  lane?: string;
  conditions?: Record<string, unknown>;
}

export interface ProviderAccessDecision {
  allowed: boolean;
  provider_id: string;
  model?: string;
  lane?: string;
  reason: string;
}

// ─── Tool Access ──────────────────────────────────────────────────────────

export interface ToolAccessRule {
  tool_id: string;
  allowed_modes: ActorMode[];
  conditions?: Record<string, unknown>;
}

export interface ToolAccessDecision {
  allowed: boolean;
  tool_id: string;
  reason: string;
}

// ─── Permission Explain ───────────────────────────────────────────────────

export interface PermissionExplain {
  actor_id: ActorId;
  actor_mode: ActorMode;
  action: Action;
  resource_kind: ResourceKind;
  resource_id: string;
  decision: PermissionDecision;
  granted_by?: string;
  denied_by?: string;
  matched_capabilities: Capability[];
  effective_mode: ActorMode;
  effective_role: ActorRole;
  reason_code: string;
  explain: string[];
  checked_at: string;
}

// ─── Permission Context ───────────────────────────────────────────────────

export interface PermissionContext {
  actor_id: ActorId;
  actor_mode: ActorMode;
  role: ActorRole;
  action: Action;
  resource_kind: ResourceKind;
  resource_id: string;
  is_owner: boolean;
  visibility_scope: VisibilityScope;
  provider_id?: string;
  tool_id?: string;
  workspace_id?: string;
  session_id?: string;
}
