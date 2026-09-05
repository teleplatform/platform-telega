import { SymbolNode, SymbolEdge, SymbolGraph, SymbolReference } from "./symbolTypes";
import { SymbolRegistry } from "./symbolRegistry";

export function buildSymbolGraph(): SymbolGraph {
  const nodes = new Map<string, SymbolNode>();
  const edges: SymbolEdge[] = [];
  const allNodes = SymbolRegistry.getAll();

  for (const node of allNodes) {
    nodes.set(node.id, node);
  }

  const nameToId = new Map<string, string>();
  for (const node of allNodes) {
    nameToId.set(node.name, node.id);
  }

  for (const node of allNodes) {
    for (const depName of node.dependencies) {
      const depId = nameToId.get(depName);
      if (depId) {
        edges.push({ from: node.id, to: depId, kind: "imports" });
      }
    }

    // If definition references another file, create edge
    if (node.definition && node.definition.file !== node.file) {
      const defNodes = SymbolRegistry.getByFile(node.definition.file);
      for (const defNode of defNodes) {
        if (defNode.name === node.name) {
          edges.push({ from: node.id, to: defNode.id, kind: "references" });
        }
      }
    }
  }

  return { nodes, edges };
}

export function getDependencyChain(symbolId: string, graph: SymbolGraph): string[] {
  const visited = new Set<string>();
  const chain: string[] = [];

  function walk(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    chain.push(id);
    const outgoing = graph.edges.filter((e) => e.from === id);
    for (const edge of outgoing) {
      walk(edge.to);
    }
  }

  walk(symbolId);
  return chain;
}

export function getDependents(symbolId: string, graph: SymbolGraph): string[] {
  return graph.edges
    .filter((e) => e.to === symbolId)
    .map((e) => e.from);
}

export function addDependency(symbolId: string, dependencyName: string): void {
  const node = SymbolRegistry.get(symbolId);
  if (!node) return;
  if (!node.dependencies.includes(dependencyName)) {
    node.dependencies.push(dependencyName);
    SymbolRegistry.update(symbolId, { dependencies: node.dependencies });
  }
}

export function addDependent(symbolId: string, dependentName: string): void {
  const node = SymbolRegistry.get(symbolId);
  if (!node) return;
  if (!node.dependents.includes(dependentName)) {
    node.dependents.push(dependentName);
    SymbolRegistry.update(symbolId, { dependents: node.dependents });
  }
}
