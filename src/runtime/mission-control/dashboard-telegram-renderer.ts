import type { AggregatedDashboardState, DashboardGraphInfo } from './dashboard-aggregator.js';

function statusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✅';
    case 'running': return '🔄';
    case 'failed': return '❌';
    case 'draft': return '📝';
    case 'ready': return '⏳';
    case 'cancelled': return '🚫';
    default: return '❓';
  }
}

function nodeBar(pending: number, running: number, completed: number, failed: number, skipped: number, total: number): string {
  if (total === 0) return '(empty)';
  const all = [pending, running, completed, failed, skipped] as const;
  const icons = ['⬜', '🔄', '✅', '❌', '⏭'];
  return all.map((count, i) => count > 0 ? `${icons[i]}${count}` : '').filter(Boolean).join(' ');
}

function contractIcon(status: string | null, verified: boolean): string {
  if (verified) return '✅';
  if (status === 'completed') return '✔';
  if (status === 'failed') return '❌';
  if (status === 'active') return '🔄';
  return '⬜';
}

export function renderFullDashboard(state: AggregatedDashboardState): string {
  const lines: string[] = [];
  const sep = '─'.repeat(32);

  lines.push('🎛 MISSION CONTROL DASHBOARD');
  lines.push(sep);

  // Sigma Forge section
  lines.push('');
  lines.push('⚡ SIGMA FORGE');
  if (state.graphs.length === 0) {
    lines.push('  No execution graphs');
  } else {
    lines.push(`  ${state.graphs.length} total (${state.contracts.active} active, ${state.contracts.completed} completed, ${state.contracts.failed} failed)`);
    for (const g of state.graphs) {
      const icon = statusIcon(g.status);
      lines.push(`  ${icon} ${g.name}`);
      lines.push(`     Intent: ${g.intent.slice(0, 60)}${g.intent.length > 60 ? '…' : ''}`);
      lines.push(`     Status: ${g.status}  |  Nodes: ${nodeBar(g.pendingNodes, g.runningNodes, g.completedNodes, g.failedNodes, g.skippedNodes, g.totalNodes)}`);
      lines.push(`     Groups: ${g.parallelGroups}  |  Phases: ${g.phases.join(' → ')}`);
      lines.push(`     ${contractIcon(g.contractStatus, g.contractVerified)} Contract: ${g.contractId ?? '-'} [${g.contractStatus ?? '-'}] verified=${g.contractVerified}`);
      if (g.durationMs != null) lines.push(`     Duration: ${g.durationMs}ms`);
    }
  }

  // Contracts summary
  const c = state.contracts;
  lines.push('');
  lines.push(`📋 CONTRACTS  ${c.total} total  ✅${c.verified}  🔄${c.active}  ✔${c.completed}  ❌${c.failed}`);

  // Browser section
  const b = state.browser;
  lines.push('');
  lines.push('🌐 BROWSER RUNTIME');
  lines.push(`  Sessions: ${b.sessionsTotal} total  🟢${b.sessionsActive}  ⚪${b.sessionsIdle}`);
  lines.push(`  Limits: max ${b.maxSessions} sessions, ${b.maxConcurrent} concurrent`);
  lines.push(`  Tasks: 📥${b.queueLength} queued  🔄${b.runningTasks} running  ✅${b.completedTasks} done  ❌${b.failedTasks} failed`);
  lines.push(`  Runner: ${b.runnerActive ? '🟢 active' : '⚫ stopped'} (${b.runnerActiveTasks} active tasks)`);
  lines.push(`  Cleaner: ${b.cleanerRuns} runs, ${b.cleanerCleaned} sessions cleaned`);

  // Evidence section
  const e = state.evidence;
  lines.push('');
  lines.push('📁 EVIDENCE & ARTIFACTS');
  lines.push(`  Evidence records: ${e.totalRecords} total  ${e.recentRecordCount} recent (5min)`);
  lines.push(`  Artifacts: ${e.artifactCount} total  📸${e.screenshotCount} screenshots`);
  lines.push(`  Failures: ❌${e.failedActions}  Blocked: 🚫${e.blockedActions}`);

  lines.push('');
  lines.push(sep);
  lines.push(`🕐 ${state.generatedAt}`);

  return lines.join('\n');
}

export function renderGraphDetails(g: DashboardGraphInfo): string {
  const lines: string[] = [];
  const icon = statusIcon(g.status);
  lines.push(`${icon} GRAPH: ${g.name}`);
  lines.push(`  ID: ${g.id}`);
  lines.push(`  Intent: ${g.intent}`);
  lines.push(`  Status: ${g.status}  |  Nodes: ${g.totalNodes}  |  Groups: ${g.parallelGroups}`);
  lines.push(`  Phases: ${g.phases.join(' → ')}`);
  lines.push(`  Node breakdown: ${nodeBar(g.pendingNodes, g.runningNodes, g.completedNodes, g.failedNodes, g.skippedNodes, g.totalNodes)}`);
  lines.push(`  ${contractIcon(g.contractStatus, g.contractVerified)} Contract: ${g.contractId ?? '-'} [${g.contractStatus ?? '-'}] verified=${g.contractVerified}`);
  if (g.durationMs != null) lines.push(`  Duration: ${g.durationMs}ms`);
  return lines.join('\n');
}

export function renderCompactDashboard(state: AggregatedDashboardState): string {
  const lines: string[] = [];
  const c = state.contracts;
  const b = state.browser;
  const e = state.evidence;

  lines.push('🎛 MC • Sigma Forge:');
  for (const g of state.graphs.slice(0, 3)) {
    const icon = statusIcon(g.status);
    const bar = nodeBar(g.pendingNodes, g.runningNodes, g.completedNodes, g.failedNodes, g.skippedNodes, g.totalNodes);
    lines.push(`  ${icon} ${g.name}  ${bar}`);
  }
  if (state.graphs.length > 3) lines.push(`  … +${state.graphs.length - 3} more`);
  lines.push(`  Contracts: ${c.total} total  ✅${c.verified}  🔄${c.active}  ✔${c.completed}`);
  lines.push(`  Browser: ${b.sessionsActive}🟢/${b.sessionsTotal} sessions  📥${b.queueLength} 📤${b.runningTasks}`);
  lines.push(`  Evidence: ${e.totalRecords} records  📸${e.screenshotCount} screenshots`);
  lines.push(`  🕐 ${state.generatedAt}`);

  return lines.join('\n');
}

export function renderSigmaForgeSection(state: AggregatedDashboardState): string {
  const lines: string[] = [];
  lines.push('⚡ Sigma Forge');
  if (state.graphs.length === 0) {
    lines.push('  No execution graphs');
  } else {
    for (const g of state.graphs) {
      const icon = statusIcon(g.status);
      const bar = nodeBar(g.pendingNodes, g.runningNodes, g.completedNodes, g.failedNodes, g.skippedNodes, g.totalNodes);
      lines.push(`  ${icon} ${g.name}  ${bar}`);
      lines.push(`    ${g.intent.slice(0, 50)}${g.intent.length > 50 ? '…' : ''}`);
    }
  }
  return lines.join('\n');
}
