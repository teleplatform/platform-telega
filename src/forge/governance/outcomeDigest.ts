import { OutcomeDigest, GovernanceOutcome } from "./governanceTypes";
import { GovernanceRegistry } from "./outcomeRegistry";

export function buildDigest(): OutcomeDigest {
  const all = GovernanceRegistry.getAll();
  if (all.length === 0) {
    return { total: 0, successRate: 0, failureRate: 0, blockedCount: 0, policyDenials: 0, humanOverrides: 0, repairSuccessRate: 0, providerReliability: {}, bySource: {}, bySeverity: {} };
  }

  const total = all.length;

  // Success/failure
  const successKinds: string[] = ["mission_success", "job_completed", "agent_success", "provider_success", "repair_succeeded", "policy_approved"];
  const failures = all.filter((o) => !successKinds.includes(o.kind));
  const successes = all.filter((o) => successKinds.includes(o.kind));

  const successRate = total > 0 ? Math.round((successes.length / total) * 10000) / 100 : 0;
  const failureRate = total > 0 ? Math.round((failures.length / total) * 10000) / 100 : 0;

  // Blocked
  const blockedCount = all.filter((o) => o.kind === "policy_denied" || o.kind === "resource_denied").length;
  const policyDenials = all.filter((o) => o.kind === "policy_denied").length;
  const humanOverrides = all.filter((o) => o.kind === "override_executed").length;

  // Repair success rate
  const repairs = all.filter((o) => o.kind === "repair_succeeded" || o.kind === "repair_failed");
  const repairSuccesses = repairs.filter((o) => o.kind === "repair_succeeded").length;
  const repairSuccessRate = repairs.length > 0 ? Math.round((repairSuccesses / repairs.length) * 10000) / 100 : 0;

  // Provider reliability
  const providerReliability: Record<string, number> = {};
  const providerOutcomes = all.filter((o) => o.source === "provider");
  const providerGroups = new Map<string, GovernanceOutcome[]>();
  for (const po of providerOutcomes) {
    const id = String(po.details.providerId || "unknown");
    if (!providerGroups.has(id)) providerGroups.set(id, []);
    providerGroups.get(id)!.push(po);
  }
  for (const [id, group] of providerGroups) {
    const provSuccesses = group.filter((o) => o.kind === "provider_success").length;
    providerReliability[id] = group.length > 0 ? Math.round((provSuccesses / group.length) * 10000) / 100 : 0;
  }

  // By source
  const bySource: Record<string, number> = {};
  for (const o of all) {
    bySource[o.source] = (bySource[o.source] || 0) + 1;
  }

  // By severity
  const bySeverity: Record<string, number> = {};
  for (const o of all) {
    bySeverity[o.severity] = (bySeverity[o.severity] || 0) + 1;
  }

  return { total, successRate, failureRate, blockedCount, policyDenials, humanOverrides, repairSuccessRate, providerReliability, bySource, bySeverity };
}
