import type { RouteDecision } from './mesh-capability-router.js';
import type { NodeScore } from './mesh-route-score-engine.js';
import type { SelectionDecision } from './local-vs-remote-selection.js';
import type { MeshNodeInfo } from './mesh-node-types.js';

export interface RouteExplanation {
  decision: string;
  factors: { factor: string; value: string; impact: 'positive' | 'negative' | 'neutral' }[];
  alternatives: string[];
  confidence: number;
  timestamp: number;
}

export function explainRouteDecision(decision: RouteDecision, nodes: MeshNodeInfo[]): RouteExplanation {
  const selectedNode = nodes.find(n => n.id === decision.selectedNodeId);
  const factors: { factor: string; value: string; impact: 'positive' | 'negative' | 'neutral' }[] = [];

  if (selectedNode) {
    factors.push({
      factor: 'Node Status',
      value: selectedNode.status,
      impact: selectedNode.status === 'online' ? 'positive' : 'negative',
    });

    factors.push({
      factor: 'Route Type',
      value: decision.routeType,
      impact: decision.routeType === 'local' ? 'positive' : 'neutral',
    });

    factors.push({
      factor: 'Score',
      value: `${decision.score}/100`,
      impact: decision.score > 70 ? 'positive' : decision.score > 40 ? 'neutral' : 'negative',
    });

    const load = selectedNode.capabilities.find(c => c.runtimeCapability === decision.capability);
    if (load) {
      factors.push({
        factor: 'Load',
        value: `${load.currentLoad}/${load.capacity}`,
        impact: load.currentLoad / load.capacity < 0.7 ? 'positive' : 'negative',
      });
    }
  }

  const alternatives = decision.alternatives.map(a =>
    `${a.nodeId} (score: ${a.score})`
  );

  return {
    decision: `Routed ${decision.taskType} to ${decision.selectedNodeName} (${decision.selectedNodeId})`,
    factors,
    alternatives,
    confidence: Math.round(decision.score / 100 * 100),
    timestamp: decision.timestamp,
  };
}

export function explainScoreDecision(scores: NodeScore[], selectedId: string): RouteExplanation {
  const selected = scores.find(s => s.nodeId === selectedId);
  const factors: { factor: string; value: string; impact: 'positive' | 'negative' | 'neutral' }[] = [];

  if (selected) {
    const f = selected.factors;
    factors.push({ factor: 'Load Balance', value: `${Math.round(f.loadBalance * 100)}%`, impact: f.loadBalance > 0.5 ? 'positive' : 'negative' });
    factors.push({ factor: 'Health', value: `${Math.round(f.health * 100)}%`, impact: f.health > 0.5 ? 'positive' : 'negative' });
    factors.push({ factor: 'Uptime', value: `${Math.round(f.uptime * 100)}%`, impact: f.uptime > 0.5 ? 'positive' : 'neutral' });
    factors.push({ factor: 'Connectivity', value: `${Math.round(f.connectivity * 100)}%`, impact: f.connectivity > 0.5 ? 'positive' : 'neutral' });
  }

  return {
    decision: `Selected node ${selectedId} with score ${selected?.totalScore || 0}`,
    factors,
    alternatives: scores.slice(0, 3).map(s => `${s.nodeId} (rank: ${s.rank}, score: ${s.totalScore})`),
    confidence: selected ? Math.round(selected.totalScore) : 0,
    timestamp: Date.now(),
  };
}

export function explainSelectionDecision(decision: SelectionDecision): RouteExplanation {
  return {
    decision: `${decision.selectionType} selected: ${decision.selectedNodeName} (${decision.selectedNodeId})`,
    factors: [{ factor: 'Selection Type', value: decision.selectionType, impact: 'positive' }],
    alternatives: decision.alternatives.map(a => `${a.nodeId} (${a.type}, score: ${a.score})`),
    confidence: 85,
    timestamp: decision.timestamp,
  };
}
