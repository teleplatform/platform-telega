import { getResults, getResultCounts } from '../sigma-forge/sigma-forge-store.js';
import { readEvidenceRecords } from '../evidence/execution-evidence-store.js';
import { artifactRegistrySummary } from '../browser/browser-artifact-registry.js';

export interface DashboardGraphInfo {
  id: string;
  name: string;
  intent: string;
  status: string;
  totalNodes: number;
  pendingNodes: number;
  runningNodes: number;
  completedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  parallelGroups: number;
  phases: string[];
  contractId: string | null;
  contractStatus: string | null;
  contractVerified: boolean;
  durationMs: number | null;
}

export interface DashboardBrowserInfo {
  sessionsTotal: number;
  sessionsActive: number;
  sessionsIdle: number;
  queueLength: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  runnerActive: boolean;
  runnerActiveTasks: number;
  cleanerRuns: number;
  cleanerCleaned: number;
  maxSessions: number;
  maxConcurrent: number;
}

export interface DashboardContractInfo {
  total: number;
  active: number;
  completed: number;
  failed: number;
  verified: number;
}

export interface DashboardEvidenceInfo {
  totalRecords: number;
  recentRecordCount: number;
  artifactCount: number;
  screenshotCount: number;
  failedActions: number;
  blockedActions: number;
}

export interface AggregatedDashboardState {
  graphs: DashboardGraphInfo[];
  contracts: DashboardContractInfo;
  browser: DashboardBrowserInfo;
  evidence: DashboardEvidenceInfo;
  generatedAt: string;
}

const NULL_BROWSER: DashboardBrowserInfo = {
  sessionsTotal: 0, sessionsActive: 0, sessionsIdle: 0,
  queueLength: 0, runningTasks: 0, completedTasks: 0, failedTasks: 0,
  runnerActive: false, runnerActiveTasks: 0,
  cleanerRuns: 0, cleanerCleaned: 0,
  maxSessions: 4, maxConcurrent: 2
};

const NULL_EVIDENCE: DashboardEvidenceInfo = {
  totalRecords: 0, recentRecordCount: 0,
  artifactCount: 0, screenshotCount: 0,
  failedActions: 0, blockedActions: 0
};

export function aggregateSigmaForgeState(): AggregatedDashboardState {
  const results = getResults();
  const counts = getResultCounts();

  const graphs: DashboardGraphInfo[] = results.map(r => {
    const g = r.graph;
    if (!g) {
      return {
        id: '(no graph)',
        name: '(error)',
        intent: r.contract?.intent ?? '(unknown)',
        status: r.completed ? 'completed' : 'failed',
        totalNodes: 0, pendingNodes: 0, runningNodes: 0,
        completedNodes: 0, failedNodes: 0, skippedNodes: 0,
        parallelGroups: 0, phases: [],
        contractId: r.contract?.id ?? null,
        contractStatus: r.contract?.status ?? null,
        contractVerified: r.contract?.verifiedExecution ?? false,
        durationMs: r.durationMs
      };
    }

    const nodes = g.nodes;
    return {
      id: g.id, name: g.name, intent: g.intent, status: g.status,
      totalNodes: nodes.length,
      pendingNodes: nodes.filter(n => n.status === 'pending').length,
      runningNodes: nodes.filter(n => n.status === 'running').length,
      completedNodes: nodes.filter(n => n.status === 'completed').length,
      failedNodes: nodes.filter(n => n.status === 'failed').length,
      skippedNodes: nodes.filter(n => n.status === 'skipped').length,
      parallelGroups: r.plan?.totalPhases ?? 0,
      phases: g.phaseOrder,
      contractId: r.contract?.id ?? null,
      contractStatus: r.contract?.status ?? null,
      contractVerified: r.contract?.verifiedExecution ?? false,
      durationMs: r.durationMs
    };
  });

  let contractActive = 0, contractCompleted = 0, contractFailed = 0, contractVerified = 0;
  for (const r of results) {
    const c = r.contract;
    if (!c) { contractFailed++; continue; }
    if (c.status === 'active') contractActive++;
    else if (c.status === 'completed') contractCompleted++;
    else if (c.status === 'failed') contractFailed++;
    if (c.verifiedExecution) contractVerified++;
  }

  return {
    graphs,
    contracts: {
      total: results.length,
      active: contractActive,
      completed: contractCompleted,
      failed: contractFailed,
      verified: contractVerified
    },
    browser: aggregateBrowserState(),
    evidence: aggregateEvidenceState(),
    generatedAt: new Date().toISOString()
  };
}

function aggregateBrowserState(): DashboardBrowserInfo {
  try {
    const { sessionStats } = require('../browser/browser-session-manager.js');
    const { queueSummary } = require('../browser/browser-task-queue.js');
    const { getConcurrentRunnerStatus } = require('../browser/browser-concurrent-runner.js');
    const { getCleanerStats } = require('../browser/browser-dead-session-cleaner.js');
    const { getResourceLimits } = require('../browser/browser-resource-limits.js');

    const stats = sessionStats();
    const queue = queueSummary();
    const runner = getConcurrentRunnerStatus();
    const cleaner = getCleanerStats();
    const limits = getResourceLimits();

    return {
      sessionsTotal: stats.total ?? 0,
      sessionsActive: stats.active ?? 0,
      sessionsIdle: stats.idle ?? 0,
      queueLength: typeof queue === 'string' ? 0 : (queue.queued ?? 0),
      runningTasks: typeof queue === 'string' ? 0 : (queue.running ?? 0),
      completedTasks: typeof queue === 'string' ? 0 : (queue.completed ?? 0),
      failedTasks: typeof queue === 'string' ? 0 : (queue.failed ?? 0),
      runnerActive: runner?.running ?? false,
      runnerActiveTasks: runner?.activeTasks ?? 0,
      cleanerRuns: cleaner?.runs ?? 0,
      cleanerCleaned: cleaner?.totalCleaned ?? 0,
      maxSessions: limits?.maxSessions ?? 4,
      maxConcurrent: limits?.maxConcurrentTasks ?? 2
    };
  } catch {
    return NULL_BROWSER;
  }
}

function aggregateEvidenceState(): DashboardEvidenceInfo {
  try {
    const records = readEvidenceRecords({ limit: 5000 });
    const now = Date.now();
    const recentRecords = records.filter(r => {
      const ts = new Date(r.timestamp).getTime();
      return Number.isFinite(ts) && now - ts < 300000;
    });
    const failedActions = records.filter(r => r.type === 'execution_failed').length;
    const blockedActions = records.filter(
      r => r.type === 'execution_policy_blocked' || r.type === 'validation_gate_failed'
    ).length;

    let artifactCount = 0;
    let screenshotCount = 0;
    try {
      const summary = artifactRegistrySummary();
      artifactCount = summary?.total ?? 0;
      screenshotCount = summary?.screenshots ?? 0;
    } catch {}

    return {
      totalRecords: records.length,
      recentRecordCount: recentRecords.length,
      artifactCount,
      screenshotCount,
      failedActions,
      blockedActions
    };
  } catch {
    return NULL_EVIDENCE;
  }
}
