import { Policy, PolicyScope, PolicySeverity } from "./policyTypes";

const policies = new Map<string, Policy>();

let counter = 0;
function genId(): string {
  counter++;
  return `policy_${Date.now()}_${counter}`;
}

export const PolicyRegistry = {
  add(policy: Omit<Policy, "policyId" | "createdAt" | "updatedAt">): Policy {
    const now = Date.now();
    const full: Policy = { ...policy, policyId: genId(), createdAt: now, updatedAt: now };
    policies.set(full.policyId, full);
    return full;
  },

  get(id: string): Policy | undefined {
    return policies.get(id);
  },

  getAll(): Policy[] {
    return Array.from(policies.values());
  },

  update(id: string, updates: Partial<Policy>): Policy | null {
    const existing = policies.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, policyId: id, updatedAt: Date.now() };
    policies.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return policies.delete(id);
  },

  listByScope(scope: PolicyScope): Policy[] {
    return Array.from(policies.values()).filter((p) => p.scope === scope && p.enabled);
  },

  listBySeverity(severity: PolicySeverity): Policy[] {
    return Array.from(policies.values()).filter((p) => p.severity === severity && p.enabled);
  },

  size(): number {
    return policies.size;
  },
};
