export interface AuditCausalityLink {
  causeEventId: string;
  effectEventId: string;
  linkType: 'assignment' | 'transport' | 'evidence' | 'worker' | 'system';
  confidence: number; // 0.0 to 1.0
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface AuditCausalityChain {
  id: string;
  rootEventId: string;
  links: AuditCausalityLink[];
  events: string[]; // ordered list of event IDs in the chain
  createdAt: number;
  updatedAt: number;
}

export class AuditCausalityChainBuilder {
  private chains = new Map<string, AuditCausalityChain>();

  addLink(causeEventId: string, effectEventId: string, linkType: AuditCausalityLink['linkType'], confidence: number = 1.0): void {
    // Find or create chain for the cause event
    let chain = this.findChainByEventId(causeEventId);
    if (!chain) {
      chain = this.createNewChain(causeEventId);
    }

    // Add the link
    const link: AuditCausalityLink = {
      causeEventId,
      effectEventId,
      linkType,
      confidence,
      timestamp: Date.now(),
      metadata: {}
    };

    chain.links.push(link);
    chain.events.push(effectEventId);
    chain.updatedAt = Date.now();

    // If effect event is not already in a chain, add it to this chain
    const effectChain = this.findChainByEventId(effectEventId);
    if (!effectChain) {
      // Effect event is new to chains, add it to current chain
    } else if (effectChain.id !== chain.id) {
      // Merge chains: effect event already in another chain, we need to merge
      this.mergeChains(chain.id, effectChain.id);
    }
  }

  private createNewChain(rootEventId: string): AuditCausalityChain {
    const chainId = `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const chain: AuditCausalityChain = {
      id: chainId,
      rootEventId: rootEventId,
      links: [],
      events: [rootEventId],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.chains.set(chainId, chain);
    return chain;
  }

  private findChainByEventId(eventId: string): AuditCausalityChain | undefined {
    for (const chain of this.chains.values()) {
      if (chain.events.includes(eventId)) {
        return chain;
      }
    }
    return undefined;
  }

  private mergeChains(chainId1: string, chainId2: string): void {
    const chain1 = this.chains.get(chainId1);
    const chain2 = this.chains.get(chainId2);
    if (!chain1 || !chain2) return;

    // Merge chain2 into chain1
    chain1.links.push(...chain2.links);
    chain1.events.push(...chain2.events.filter(eid => !chain1.events.includes(eid)));
    chain1.updatedAt = Date.now();

    // Remove chain2
    this.chains.delete(chainId2);
  }

  getChainByEventId(eventId: string): AuditCausalityChain | undefined {
    return this.findChainByEventId(eventId);
  }

  getChain(id: string): AuditCausalityChain | undefined {
    return this.chains.get(id);
  }

  getAllChains(): AuditCausalityChain[] {
    return Array.from(this.chains.values());
  }

  clearChains(): void {
    this.chains.clear();
    this.evidenceToChain.clear();
  }

  // === Evidence Fabric Lineage Layer ===

  private evidenceToChain = new Map<string, string>(); // evidenceId → primary chainId

  /**
   * Link an evidence record into the causality graph.
   * This is the key entry point for "given evidence → reconstruct chain".
   */
  linkEvidence(causeEventId: string, evidenceId: string, confidence: number = 1.0): void {
    const linkType: AuditCausalityLink['linkType'] = 'evidence';

    this.addLink(causeEventId, evidenceId, linkType, confidence);

    // Record reverse mapping for fast reconstruction
    const chain = this.findChainByEventId(evidenceId) || this.findChainByEventId(causeEventId);
    if (chain) {
      this.evidenceToChain.set(evidenceId, chain.id);
      // also store evidenceId in the link metadata for traceability
      const lastLink = chain.links[chain.links.length - 1];
      if (lastLink) {
        lastLink.metadata = {
          ...lastLink.metadata,
          evidenceId,
        };
      }
    }
  }

  /**
   * Given any evidenceId, reconstruct the full distributed execution chain
   * that led to it (and what followed from it).
   */
  reconstructExecutionChainFromEvidence(evidenceId: string): AuditCausalityChain | undefined {
    // Direct lookup
    const chainId = this.evidenceToChain.get(evidenceId);
    if (chainId) {
      return this.chains.get(chainId);
    }

    // Fallback: search all chains for any link that references this evidenceId
    for (const chain of this.chains.values()) {
      const hasEvidence = chain.links.some(link =>
        link.metadata?.evidenceId === evidenceId ||
        link.causeEventId === evidenceId ||
        link.effectEventId === evidenceId
      );
      if (hasEvidence) {
        this.evidenceToChain.set(evidenceId, chain.id); // cache for future
        return chain;
      }
    }

    return undefined;
  }

  getEvidenceChain(evidenceId: string): AuditCausalityChain | undefined {
    return this.reconstructExecutionChainFromEvidence(evidenceId);
  }

  /**
   * Reconstruct the layered view of the execution for a given evidence.
   * Returns the chain plus a breakdown by layer (assignment / transport / evidence / worker / system).
   */
  reconstructLayeredExecutionChain(evidenceId: string): {
    chain: AuditCausalityChain | undefined;
    layers: Record<AuditCausalityLink['linkType'], string[]>;
  } {
    const chain = this.reconstructExecutionChainFromEvidence(evidenceId);
    const layers: Record<AuditCausalityLink['linkType'], string[]> = {
      assignment: [],
      transport: [],
      evidence: [],
      worker: [],
      system: [],
    };

    if (!chain) {
      return { chain: undefined, layers };
    }

    for (const link of chain.links) {
      layers[link.linkType].push(link.effectEventId);
      if (!layers[link.linkType].includes(link.causeEventId)) {
        // include cause as well for completeness
        layers[link.linkType].unshift(link.causeEventId);
      }
    }

    return { chain, layers };
  }
}

export function analyzeCausality(chain: AuditCausalityChain): {
  depth: number;
  breadth: number;
  confidence: number;
  criticalPath: string[];
} {
  if (!chain.links.length) {
    return { depth: 0, breadth: 0, confidence: 0, criticalPath: [] };
  }

  // Build adjacency list
  const adj: Record<string, string[]> = {};
  const reverseAdj: Record<string, string[]> = {};

  for (const link of chain.links) {
    if (!adj[link.causeEventId]) adj[link.causeEventId] = [];
    adj[link.causeEventId].push(link.effectEventId);

    if (!reverseAdj[link.effectEventId]) reverseAdj[link.effectEventId] = [];
    reverseAdj[link.effectEventId].push(link.causeEventId);
  }

  // Find root (event with no incoming edges)
  const root = chain.events.find(eid => !reverseAdj[eid] || reverseAdj[eid].length === 0);
  if (!root) return { depth: 0, breadth: 0, confidence: 0, criticalPath: [] };

  // Calculate depth and critical path using DFS
  const visited = new Set<string>();
  const pathStack: string[] = [];
  let maxDepth = 0;
  let bestPath: string[] = [];

  function dfs(node: string, depth: number, currentPath: string[]): void {
    if (visited.has(node)) return;
    visited.add(node);
    currentPath.push(node);

    if (depth > maxDepth) {
      maxDepth = depth;
      bestPath = [...currentPath];
    }

    const neighbors = adj[node] || [];
    for (const neighbor of neighbors) {
      dfs(neighbor, depth + 1, [...currentPath]);
    }

    currentPath.pop();
  }

  dfs(root, 0, []);

  // Calculate breadth (max width at any level)
  const levels: Record<number, string[]> = {};
  function calculateBreadth(node: string, level: number): void {
    if (!levels[level]) levels[level] = [];
    levels[level].push(node);
    const neighbors = adj[node] || [];
    for (const neighbor of neighbors) {
      calculateBreadth(neighbor, level + 1);
    }
  }

  calculateBreadth(root, 0);
  let maxBreadth = 0;
  for (const level in levels) {
    maxBreadth = Math.max(maxBreadth, levels[level].length);
  }

  // Calculate average confidence
  const totalConfidence = chain.links.reduce((sum, link) => sum + link.confidence, 0);
  const avgConfidence = chain.links.length > 0 ? totalConfidence / chain.links.length : 0;

  return {
    depth: maxDepth,
    breadth: maxBreadth,
    confidence: avgConfidence,
    criticalPath: bestPath
  };
}