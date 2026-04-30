export interface AgentPolicy {
  agent_id: string;
  allowed_tools: string[];
  denied_tools: string[];
  allowed_memory_scopes: string[];
  write_requires_approval: boolean;
  external_send_requires_sanitization: boolean;
  max_parallel_jobs: number;
}

export interface PolicyDecision {
  allowed: boolean;
  reasons: string[];
  matched_rules: string[];
  approval_required: boolean;
}

export interface PolicyCheckInput {
  agent_id: string;
  tool_id?: string;
  memory_scope?: string;
  action_type?: "read" | "write" | "send" | "execute";
  target_kind?: "provider" | "tool" | "memory" | "channel";
}
