import type { AgentPolicy, PolicyDecision, PolicyCheckInput } from "../../runtime-safety-contracts/src/policy.js";

export interface PolicyRegistry {
  registerPolicy(policy: AgentPolicy): void;
  getPolicy(agent_id: string): AgentPolicy | undefined;
  listPolicies(): AgentPolicy[];
}

export function createPolicyRegistry(): PolicyRegistry {
  const policies = new Map<string, AgentPolicy>();

  return {
    registerPolicy(policy) {
      policies.set(policy.agent_id, policy);
    },
    getPolicy(agent_id) {
      return policies.get(agent_id);
    },
    listPolicies() {
      return Array.from(policies.values());
    },
  };
}

export function resolvePolicy(policy: AgentPolicy, input: PolicyCheckInput): PolicyDecision {
  const reasons: string[] = [];
  const matched_rules: string[] = [];
  let approval_required = false;

  // Check denied tools
  if (input.tool_id && policy.denied_tools.includes(input.tool_id)) {
    reasons.push(`tool ${input.tool_id} is denied`);
    matched_rules.push("denied_tools");
  }

  // Check allowed tools (if non-empty, tool must be in allowlist)
  if (input.tool_id && policy.allowed_tools.length > 0 && !policy.allowed_tools.includes(input.tool_id)) {
    reasons.push(`tool ${input.tool_id} not in allowlist`);
    matched_rules.push("allowed_tools");
  }

  // Check memory scope
  if (input.memory_scope && !policy.allowed_memory_scopes.includes(input.memory_scope)) {
    reasons.push(`memory scope ${input.memory_scope} not allowed`);
    matched_rules.push("memory_scope");
  }

  // Check write approval
  if (input.action_type === "write" && policy.write_requires_approval) {
    approval_required = true;
    matched_rules.push("write_requires_approval");
  }

  // Check external send sanitization
  if (input.action_type === "send" && policy.external_send_requires_sanitization) {
    approval_required = true;
    matched_rules.push("external_send_requires_sanitization");
  }

  const allowed = reasons.length === 0;

  return {
    allowed,
    reasons,
    matched_rules,
    approval_required,
  };
}

export interface PolicyEngineContext {
  registry: PolicyRegistry;
}

export function runPolicyEngine(input: PolicyCheckInput, context: PolicyEngineContext): PolicyDecision {
  const policy = context.registry.getPolicy(input.agent_id);
  if (!policy) {
    return { allowed: false, reasons: ["no_policy_found_for_agent"], matched_rules: [], approval_required: false };
  }
  return resolvePolicy(policy, input);
}
