import type { ControlCommandRequest, ControlCommandResult } from './control-types.js';
import { getResults } from '../sigma-forge/sigma-forge-store.js';
import { pauseGraph, resumeGraph, cancelGraph, getControlState, initControlState, checkControl } from '../sigma-forge/graph-control-store.js';
import { getParallelGroups, topologicalSort, updateNodeStatus, markGraphStatus } from '../sigma-forge/execution-graph.js';
import { emitMissionControlLiveEvent } from '../hooks/mission-control-live-feed-hook.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';

export async function handleGraphCommand(req: ControlCommandRequest): Promise<ControlCommandResult> {
  const { command, graphId } = req;

  if (!graphId) {
    return { ok: false, command, message: 'graphId is required', error: 'missing graphId' };
  }

  const result = getResults().find(r => r.graph?.id === graphId);
  if (!result || !result.graph) {
    return { ok: false, command, message: `Graph ${graphId} not found`, error: 'not_found' };
  }

  const graph = result.graph;

  switch (command) {
    case 'pause': {
      const ok = pauseGraph(graphId);
      if (!ok) return { ok: false, command, message: `Failed to pause graph ${graphId}`, error: 'control_state_missing' };

      await emitMissionControlLiveEvent({
        kind: 'execution_started',
        severity: 'info',
        title: `Paused graph: ${graph.name}`,
        trace_id: graphId,
        payload: { graphId, name: graph.name, pausedAt: Date.now() }
      });

      const progress = getNodeProgress(graph.nodes);
      return {
        ok: true, command,
        message: `Paused graph ${graph.name}. ${progress.completed}/${graph.nodes.length} nodes done`,
        data: { graphId, status: graph.status, ...progress }
      };
    }

    case 'resume': {
      const ok = resumeGraph(graphId);
      if (!ok) return { ok: false, command, message: `Failed to resume graph ${graphId}`, error: 'control_state_missing' };

      await emitMissionControlLiveEvent({
        kind: 'execution_completed',
        severity: 'info',
        title: `Resumed graph: ${graph.name}`,
        trace_id: graphId,
        payload: { graphId, name: graph.name }
      });

      return {
        ok: true, command,
        message: `Resumed graph ${graph.name}. Execution continuing...`,
        data: { graphId, status: graph.status }
      };
    }

    case 'cancel': {
      const ok = cancelGraph(graphId);
      if (!ok) return { ok: false, command, message: `Failed to cancel graph ${graphId}`, error: 'control_state_missing' };

      await emitMissionControlLiveEvent({
        kind: 'execution_failed',
        severity: 'high',
        title: `Cancelled graph: ${graph.name}`,
        trace_id: graphId,
        payload: { graphId, name: graph.name, cancelledAt: Date.now() }
      });

      markGraphStatus(graph, 'cancelled');
      const pending = graph.nodes.filter(n => n.status === 'pending' || n.status === 'ready' || n.status === 'running');
      for (const node of pending) {
        updateNodeStatus(graph, node.id, 'skipped', { completedAt: Date.now() });
      }

      const progress = getNodeProgress(graph.nodes);
      return {
        ok: true, command,
        message: `Cancelled graph ${graph.name}. ${progress.completed}/${graph.nodes.length} nodes completed, ${progress.skipped} skipped`,
        data: { graphId, status: 'cancelled', ...progress }
      };
    }

    case 'retry': {
      const nodeId = req.nodeId;
      const failedNodes = graph.nodes.filter(n => n.status === 'failed' || (nodeId && n.id === nodeId));
      if (failedNodes.length === 0) {
        return { ok: false, command, message: 'No failed nodes to retry', error: 'no_failed_nodes' };
      }

      for (const node of failedNodes) {
        updateNodeStatus(graph, node.id, 'pending', { error: null, retryCount: 0, output: null });
      }

      markGraphStatus(graph, 'ready');

      await emitMissionControlLiveEvent({
        kind: 'execution_started',
        severity: 'low',
        title: `Retrying ${failedNodes.length} failed node(s) in graph: ${graph.name}`,
        trace_id: graphId,
        payload: { graphId, name: graph.name, retryNodes: failedNodes.length, nodeIds: failedNodes.map(n => n.id) }
      });

      return {
        ok: true, command,
        message: `Reset ${failedNodes.length} failed node(s) to pending. Run synthesize again to retry.`,
        data: { graphId, retryNodes: failedNodes.length, nodeIds: failedNodes.map(n => n.id) }
      };
    }

    default:
      return { ok: false, command, message: `Unknown graph command: ${command}`, error: 'unknown_command' };
  }
}

export async function handleReplayCommand(req: ControlCommandRequest): Promise<ControlCommandResult> {
  const { command, graphId } = req;
  if (!graphId) {
    return { ok: false, command, message: 'graphId is required', error: 'missing graphId' };
  }

  const result = getResults().find(r => r.graph?.id === graphId);
  if (!result || !result.graph) {
    return { ok: false, command, message: `Graph ${graphId} not found`, error: 'not_found' };
  }

  const graph = result.graph;
  const intent = graph.intent;
  const templateName = graph.name;

  await emitMissionControlLiveEvent({
    kind: 'replay_started',
    severity: 'info',
    title: `Replaying: ${templateName} (${intent.slice(0, 40)}...)`,
    trace_id: graphId,
    payload: { graphId, intent, templateName }
  });

  return {
    ok: true, command,
    message: `Replay prepared for graph ${graphId} (${templateName}). Re-run with SigmaForge.synthesize('${intent}')`,
    data: { graphId, intent, templateName, originalNodes: graph.nodes.length }
  };
}

export async function handleExportEvidenceCommand(req: ControlCommandRequest): Promise<ControlCommandResult> {
  const { command, graphId } = req;
  if (!graphId) {
    return { ok: false, command, message: 'graphId is required', error: 'missing graphId' };
  }

  const result = getResults().find(r => r.graph?.id === graphId);
  if (!result || !result.graph) {
    return { ok: false, command, message: `Graph ${graphId} not found`, error: 'not_found' };
  }

  const graph = result.graph;
  const evidenceRefs = graph.nodes.filter(n => n.evidenceRef).map(n => n.evidenceRef!);
  const failedNodes = graph.nodes.filter(n => n.status === 'failed').map(n => ({
    id: n.id, label: n.label, taskType: n.taskType, error: n.error
  }));

  const exported = {
    graphId: graph.id,
    graphName: graph.name,
    intent: graph.intent,
    status: graph.status,
    totalNodes: graph.nodes.length,
    evidenceCount: evidenceRefs.length,
    evidenceRefs,
    failedNodes,
    completedAt: graph.updatedAt
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(graphId, 'evidence_exported'),
    trace_id: graphId,
    job_id: 'control_export',
    type: 'artifact_emitted',
    timestamp: new Date().toISOString(),
    payload: exported
  });

  return {
    ok: true, command,
    message: `Exported ${evidenceRefs.length} evidence refs${failedNodes.length > 0 ? `, ${failedNodes.length} failed nodes` : ''}`,
    data: exported as unknown as Record<string, unknown>
  };
}

function getNodeProgress(nodes: { status: string }[]): { completed: number; failed: number; pending: number; running: number; skipped: number; total: number } {
  return {
    total: nodes.length,
    completed: nodes.filter(n => n.status === 'completed').length,
    failed: nodes.filter(n => n.status === 'failed').length,
    pending: nodes.filter(n => n.status === 'pending').length,
    running: nodes.filter(n => n.status === 'running').length,
    skipped: nodes.filter(n => n.status === 'skipped').length
  };
}
