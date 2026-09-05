import { Policy } from "./policyTypes";
import { PolicyRegistry } from "./policyRegistry";

const DEFAULT_POLICIES: Array<Omit<Policy, "policyId" | "createdAt" | "updatedAt">> = [
  {
    name: "Local Only Mode",
    description: "When session lock is active, forbid non-local providers",
    scope: "provider",
    severity: "critical",
    enabled: true,
    rules: [
      {
        ruleId: "rule_local_only",
        name: "Require local provider",
        description: "Block API/Web providers in local mode",
        effect: "deny",
        priority: 100,
        conditions: [
          { field: "requiresLocalModel", operator: "eq", value: true },
          { field: "providerId", operator: "not_in", value: ["local:gemma3n", "local:deepseek", "local:qwen3:8b", "local:mistral", "local:gemma4:12b", "local:minicpm-v", "local:moondream", "local:translategemma"] },
        ],
        reason: "Local Only Mode active — non-local providers denied",
      },
    ],
  },
  {
    name: "Provider Cost Control",
    description: "Limit expensive provider usage",
    scope: "provider",
    severity: "high",
    enabled: true,
    rules: [
      {
        ruleId: "rule_cost_limit",
        name: "Cost limit check",
        description: "Deny if estimated cost exceeds $0.10 per request",
        effect: "deny",
        priority: 80,
        conditions: [
          { field: "estimatedCostUsd", operator: "gt", value: 0.1 },
        ],
        reason: "Estimated cost exceeds $0.10 limit",
      },
    ],
  },
  {
    name: "Resource Protection",
    description: "Protect system resources from heavy models",
    scope: "resource",
    severity: "high",
    enabled: true,
    rules: [
      {
        ruleId: "rule_heavy_model",
        name: "Heavy model guard",
        description: "Require approval for models > 4GB on low RAM",
        effect: "require_approval",
        priority: 90,
        conditions: [
          { field: "modelId", operator: "matches", value: "gemma4:12b|qwen3:8b" },
          { field: "estimatedRuntimeMs", operator: "gt", value: 60000 },
        ],
        reason: "Heavy model requires human approval",
      },
    ],
  },
  {
    name: "Mission Scope Control",
    description: "Agent can only access permitted mission scopes",
    scope: "mission",
    severity: "high",
    enabled: true,
    rules: [
      {
        ruleId: "rule_mission_scope",
        name: "Scope enforcement",
        description: "Block agents from accessing out-of-scope missions",
        effect: "deny",
        priority: 85,
        conditions: [
          { field: "agentRole", operator: "in", value: ["tester", "verifier"] },
          { field: "action", operator: "matches", value: "mission.create|mission.delete" },
        ],
        reason: "Tester/Verifier agents cannot create or delete missions",
      },
    ],
  },
  {
    name: "Internet Access Control",
    description: "Control which agents can access the internet",
    scope: "system",
    severity: "medium",
    enabled: true,
    rules: [
      {
        ruleId: "rule_internet_access",
        name: "Internet access policy",
        description: "Researcher agents can access internet; others require approval",
        effect: "require_approval",
        priority: 70,
        conditions: [
          { field: "requiresInternet", operator: "eq", value: true },
          { field: "agentRole", operator: "neq", value: "researcher" },
        ],
        reason: "Non-researcher agents require approval for internet access",
      },
    ],
  },
];

export function seedDefaultPolicies(): void {
  for (const p of DEFAULT_POLICIES) {
    PolicyRegistry.add(p);
  }
}
