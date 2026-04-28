
// Agent Runtime MVP v1 Types

export type AgentSessionId = string; // sid_01H...
export type RequestId = string; // rid_01H...
export type EventId = string; // eid_01H...
export type SpanId = string; // sp_01H...
export type Subject = string; // Format: "tg:<telegram_user_id>" | "api:<api_key_id>" | "user:<uuid>" | "maker:<uuid>"

export type AgentSessionState =
  | "created"
  | "planning"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "terminated";

export type ToolKind = "net.fetch" | "fs.read" | "terminal.exec";

export type PolicyDecision = "allow" | "deny" | "needs_approval";

export type TraceEventType =
  | "session.created"
  | "session.state_changed"
  | "session.completed"
  | "session.failed"
  | "session.terminated"
  | "plan.created"
  | "step.started"
  | "step.finished"
  | "policy.checked"
  | "policy.denied"
  | "policy.allowed"
  | "tool.called"
  | "tool.result"
  | "evidence.artifact_written"
  | "evidence.bundle_finalized";

export type TraceEvent = {
  v: number;
  ts: string; // ISO 8601
  rid: RequestId;
  sid: AgentSessionId;
  eid: EventId;
  type: TraceEventType;
  lvl: "info" | "warn" | "error";
  actor: {
    kind: "agent" | "tool" | "system" | "user";
    id: string;
  };
  span: {
    span_id: SpanId;
    parent_span_id: SpanId | null;
  };
  data: Record<string, any>;
  hash?: {
    alg: string;
    prev: string;
    self: string;
  };
};

export type AgentSession = {
  sid: AgentSessionId;
  rid: RequestId;
  state: AgentSessionState;
  policy_profile: string;
  plan: AgentPlan | null;
  step_cursor: number;
  tools: ToolKind[];
  owner_id: string;
  visibility_scope: "private" | "shared" | "internal" | "public";
  selected_lane?: string;
  selected_provider?: string;
  selected_model?: string;
  router_reason_code?: string;
  fallback_count?: number;
  router_decision_ref?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  terminated_at?: string;
  terminal?: {
    reason?: string;
    error?: string;
  };
};

export type AgentPlan = {
  plan_id: string;
  kind: "text" | "steps" | "jobgraph";
  summary: string;
  steps: AgentStep[];
};

export type AgentStep = {
  step_id: string;
  title: string;
  intent?: string;
  inputs?: Record<string, any>;
  expected_artifacts?: string[];
};

export type ToolCall = {
  tool_kind: ToolKind;
  params: Record<string, any>;
};

export type PolicyResult = {
  allow: boolean;
  reason: string;
  rule_id: string;
  decision: PolicyDecision;
};

export type ToolResult = {
  ok: boolean;
  result_ref?: string;
  status?: number;
  error?: string;
};

export type EvidenceBundle = {
  bundle_id: string;
  sid: AgentSessionId;
  created_at: string;
  files: EvidenceFile[];
  manifest: EvidenceManifest;
  seal: EvidenceSeal;
};

export type EvidenceFile = {
  path: string;
  bytes: number;
  sha256: string;
  kind: "trace" | "artifact" | "manifest" | "seal";
  tags?: string[];
};

export type EvidenceManifest = {
  v: number;
  bundle_id: string;
  sid: string;
  created_at: string;
  producer: {
    kind: string;
    version: string;
  };
  files: EvidenceFile[];
  redaction?: {
    ruleset_id: string;
    notes: string;
  };
  tool_policy?: {
    ruleset_id: string;
    notes: string;
  };
};

export type EvidenceSeal = {
  v: number;
  alg: string;
  canonicalization: string;
  bundle_hash: string;
  manifest_sha256: string;
  trace_sha256: string;
  sealed_at: string;
  policy: {
    hash_includes: string[];
    order: boolean;
  };
};

// Forge Handshake Types
export type ForgeWorkspace = {
  kind: "worktree";
  root: string;
  allow_paths?: string[];
  deny_paths?: string[];
};

export type ForgeToolProxy = {
  base_url: string;
  auth: {
    type: "bearer";
    token: string;
  };
};

export type ForgeConfig = {
  workspace?: ForgeWorkspace;
  tool_proxy?: ForgeToolProxy;
};
