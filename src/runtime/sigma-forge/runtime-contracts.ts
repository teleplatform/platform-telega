import { RuntimeContract, ExecutionGraph, RuntimePlan } from './sigma-forge-types.js';

let contractCounter = 0;

function generateContractId(): string {
  return `rc_${Date.now()}_${String(++contractCounter).padStart(4, '0')}`;
}

export function createContract(
  intent: string,
  buildTask: string,
  graph: ExecutionGraph,
  plan: RuntimePlan
): RuntimeContract {
  return {
    id: generateContractId(),
    intent,
    buildTask,
    executionGraphId: graph.id,
    runtimePlanId: plan.id,
    verifiedExecution: false,
    evidenceRefs: [],
    createdAt: Date.now(),
    completedAt: null,
    status: 'active'
  };
}

export function completeContract(contract: RuntimeContract, evidenceRefs: string[]): void {
  contract.verifiedExecution = true;
  contract.evidenceRefs = evidenceRefs;
  contract.completedAt = Date.now();
  contract.status = 'completed';
}

export function failContract(contract: RuntimeContract): void {
  contract.status = 'failed';
  contract.completedAt = Date.now();
}

export function verifyContract(contract: RuntimeContract): boolean {
  return contract.status === 'completed' && contract.verifiedExecution;
}

export function formatContractSummary(contract: RuntimeContract): string {
  const lines = [
    `📋 Contract: ${contract.id}`,
    `  Intent: ${contract.intent}`,
    `  Graph: ${contract.executionGraphId}`,
    `  Plan: ${contract.runtimePlanId}`,
    `  Status: ${contract.status}`,
    `  Verified: ${contract.verifiedExecution}`,
    `  Evidence: ${contract.evidenceRefs.length} refs`,
    `  Created: ${new Date(contract.createdAt).toISOString()}`
  ];
  if (contract.completedAt) {
    lines.push(`  Completed: ${new Date(contract.completedAt).toISOString()}`);
  }
  return lines.join('\n');
}
