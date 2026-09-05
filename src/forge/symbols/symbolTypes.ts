export type SymbolKind =
  | "class" | "interface" | "function" | "method" | "variable"
  | "type" | "enum" | "module" | "property" | "constant";

export interface SymbolRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface SymbolReference {
  file: string;
  line: number;
  character: number;
}

export interface SymbolNode {
  id: string;
  name: string;
  kind: SymbolKind;
  file: string;
  range: SymbolRange;
  language: string;
  definition: SymbolReference | null;
  references: SymbolReference[];
  hoverContent: string | null;
  dependencies: string[];
  dependents: string[];
  updatedAt: number;
}

export interface SymbolEdge {
  from: string;
  to: string;
  kind: "imports" | "extends" | "implements" | "calls" | "references";
}

export interface SymbolGraph {
  nodes: Map<string, SymbolNode>;
  edges: SymbolEdge[];
}

export interface ImpactResult {
  symbol: string;
  symbolKind: string;
  file: string;
  risk: "low" | "medium" | "high" | "critical";
  affectedFiles: number;
  affectedSymbols: Array<{ name: string; file: string; kind: string }>;
  dependencyChain: string[];
  recommendedChecks: string[];
}

export interface SafeContext {
  symbol: string;
  definition: { file: string; line: number; content: string } | null;
  relatedTypes: Array<{ name: string; file: string; kind: string }>;
  directReferences: Array<{ file: string; line: number; snippet: string }>;
  totalReferences: number;
  estimatedTokens: number;
}
