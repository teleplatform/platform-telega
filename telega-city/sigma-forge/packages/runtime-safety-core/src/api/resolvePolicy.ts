import type { PolicyCheckInput, PolicyDecision } from "../../runtime-safety-contracts/src/policy.js";
import { createPolicyRegistry, runPolicyEngine } from "../policy/policyEngine.js";
import { createPoliciesRepo } from "../storage/sqlite/identitiesRepo.js";
import type Database from "better-sqlite3";

export function resolveRuntimePolicy(input: PolicyCheckInput, db: Database.Database): PolicyDecision {
  const policiesRepo = createPoliciesRepo(db);
  const registry = createPolicyRegistry();
  const policy = policiesRepo.getPolicy(input.agent_id);
  if (!policy) {
    return { allowed: false, reasons: ["no_policy_found_for_agent"], matched_rules: [], approval_required: false };
  }
  registry.registerPolicy(policy);
  return runPolicyEngine(input, { registry });
}
