import { getAllWorkers, workerRegistrySummary } from './worker-registry.js';
import { getAllFederations, federatedSummary } from './worker-federation-registry.js';
import { getRemoteHeartbeatStats } from './remote-heartbeat.js';
import { getAllCrossRuntimeContracts, crossRuntimeSummary } from './cross-runtime-contracts.js';

export interface FederatedDashboardState {
  localWorkers: number;
  remoteWorkers: number;
  federations: number;
  onlineFederations: number;
  crossContracts: number;
  remoteHeartbeats: number;
  remoteFailures: number;
}

export function getFederatedDashboardState(): FederatedDashboardState {
  const allWorkers = getAllWorkers();
  const localWorkers = allWorkers.filter(w => w.kind === 'local').length;
  const remoteWorkers = allWorkers.filter(w => w.kind === 'remote').length;
  const federations = getAllFederations();
  const onlineFederations = federations.filter(f => f.status === 'online').length;
  const crossContracts = getAllCrossRuntimeContracts().length;
  const hbStats = getRemoteHeartbeatStats();

  return {
    localWorkers,
    remoteWorkers,
    federations: federations.length,
    onlineFederations,
    crossContracts,
    remoteHeartbeats: hbStats.totalHeartbeats,
    remoteFailures: hbStats.failures
  };
}

export function renderFederatedDashboard(): string {
  const lines: string[] = [];
  const sep = '─'.repeat(32);

  lines.push('🌐 FEDERATED WORKER DASHBOARD');
  lines.push(sep);

  const state = getFederatedDashboardState();
  lines.push(`Local workers: ${state.localWorkers}`);
  lines.push(`Remote workers: ${state.remoteWorkers}`);
  lines.push(`Federations: ${state.federations} (${state.onlineFederations} online)`);
  lines.push(`Cross-runtime contracts: ${state.crossContracts}`);
  lines.push(`Remote heartbeats: ${state.remoteHeartbeats} (${state.remoteFailures} failures)`);
  lines.push('');

  const federations = getAllFederations();
  if (federations.length > 0) {
    lines.push('Federated Runtimes:');
    for (const f of federations) {
      const statusIcon = f.status === 'online' ? '🟢' : f.status === 'degraded' ? '🟡' : '🔴';
      lines.push(`  ${statusIcon} ${f.name} (${f.baseUrl})`);
      lines.push(`     Status: ${f.status} | Workers: ${f.remoteWorkers.length} | Capabilities: ${f.capabilities.length}`);
      lines.push(`     Version: ${f.version} | Last seen: ${new Date(f.lastSeen).toISOString()}`);
    }
  } else {
    lines.push('No federated runtimes');
  }
  lines.push('');

  const contracts = getAllCrossRuntimeContracts();
  if (contracts.length > 0) {
    lines.push('Cross-Runtime Contracts:');
    for (const c of contracts.slice(0, 5)) {
      const icon = c.status === 'completed' ? '✅' : c.status === 'active' ? '🔄' : '❌';
      lines.push(`  ${icon} ${c.contractId} — ${c.intent.slice(0, 40)}...`);
      lines.push(`     ${c.remoteRuntimes.length} runtimes, ${c.totalAssignments} assignments, ${c.totalEvidenceRefs} evidence refs`);
    }
    if (contracts.length > 5) lines.push(`  ... +${contracts.length - 5} more`);
  } else {
    lines.push('No cross-runtime contracts');
  }

  lines.push('');
  lines.push(sep);
  lines.push(federatedSummary());
  lines.push(crossRuntimeSummary());

  return lines.join('\n');
}

export function renderFederatedWorkerCompact(): string {
  const state = getFederatedDashboardState();
  return `🌐 Federation: ${state.federations} runtimes, ${state.remoteWorkers} remote workers, ${state.crossContracts} cross-contracts, ${state.remoteHeartbeats} heartbeats`;
}
