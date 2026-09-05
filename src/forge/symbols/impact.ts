import { ImpactResult, SymbolNode } from "./symbolTypes";
import { SymbolRegistry } from "./symbolRegistry";
import { buildSymbolGraph, getDependencyChain, getDependents } from "./symbolGraph";

function assessRisk(node: SymbolNode, totalAffected: number): ImpactResult["risk"] {
  if (totalAffected >= 20) return "critical";
  if (totalAffected >= 10) return "high";
  if (totalAffected >= 4) return "medium";
  return "low";
}

function generateChecks(symbol: string, files: string[]): string[] {
  const checks: string[] = [];

  if (files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js"))) {
    checks.push("npm run typecheck");
    checks.push("npm test");
  }
  if (files.some((f) => f.endsWith(".py"))) {
    checks.push("pytest");
    checks.push("mypy .");
  }
  if (files.some((f) => f.endsWith(".go"))) {
    checks.push("go build ./...");
    checks.push("go test ./...");
  }
  if (files.some((f) => f.endsWith(".rs"))) {
    checks.push("cargo check");
    checks.push("cargo test");
  }

  checks.push(`Verify all references to \`${symbol}\` are updated`);
  return checks;
}

export function analyzeImpact(symbolName: string): ImpactResult | null {
  const nodes = SymbolRegistry.getByName(symbolName);
  if (nodes.length === 0) return null;

  const primary = nodes[0];
  const graph = buildSymbolGraph();
  const depChain = getDependencyChain(primary.id, graph);
  const dependentIds = getDependents(primary.id, graph);

  const affectedIds = [...depChain, ...dependentIds];
  const uniqueIds = [...new Set(affectedIds)];

  const affectedSymbols = uniqueIds
    .map((id) => SymbolRegistry.get(id))
    .filter((n): n is SymbolNode => !!n)
    .map((n) => ({ name: n.name, file: n.file, kind: n.kind }));

  const affectedFiles = [...new Set(affectedSymbols.map((s) => s.file))];
  const risk = assessRisk(primary, affectedFiles.length);

  const depNames = depChain
    .map((id) => SymbolRegistry.get(id))
    .filter((n): n is SymbolNode => !!n)
    .map((n) => n.name);

  return {
    symbol: symbolName,
    symbolKind: primary.kind,
    file: primary.file,
    risk,
    affectedFiles: affectedFiles.length,
    affectedSymbols,
    dependencyChain: depNames,
    recommendedChecks: generateChecks(symbolName, affectedFiles),
  };
}
