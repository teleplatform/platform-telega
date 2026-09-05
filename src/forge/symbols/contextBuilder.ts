import { SafeContext } from "./symbolTypes";
import { SymbolRegistry } from "./symbolRegistry";
import * as fs from "fs";

const MAX_CONTENT_LENGTH = 200;

function readFileSnippet(file: string, line: number): string {
  try {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");
    const start = Math.max(0, line - 2);
    const end = Math.min(lines.length, line + 5);
    return lines.slice(start, end).join("\n");
  } catch {
    return "";
  }
}

export function buildSafeContext(symbolName: string): SafeContext | null {
  const nodes = SymbolRegistry.getByName(symbolName);
  if (nodes.length === 0) return null;

  const primary = nodes[0];
  let estimatedTokens = 0;

  // Definition
  const defContent = primary.definition
    ? readFileSnippet(primary.definition.file, primary.definition.line)
    : "";
  estimatedTokens += defContent.length;

  const definition = primary.definition
    ? { file: primary.definition.file, line: primary.definition.line, content: defContent.slice(0, MAX_CONTENT_LENGTH) }
    : null;

  // Related types (dependencies and dependents)
  const relatedIds = [...primary.dependencies, ...primary.dependents];
  const relatedTypes = relatedIds
    .map((name) => SymbolRegistry.getByName(name))
    .flat()
    .filter((n): n is any => !!n)
    .map((n) => ({ name: n.name, file: n.file, kind: n.kind }))
    .slice(0, 20);

  for (const rt of relatedTypes) {
    estimatedTokens += rt.name.length + rt.file.length;
  }

  // Direct references
  const directReferences = (primary.references || [])
    .slice(0, 15)
    .map((ref) => ({
      file: ref.file,
      line: ref.line,
      snippet: readFileSnippet(ref.file, ref.line).slice(0, MAX_CONTENT_LENGTH),
    }));

  for (const dr of directReferences) {
    estimatedTokens += dr.snippet.length;
  }

  estimatedTokens = Math.round(estimatedTokens / 4);

  return {
    symbol: symbolName,
    definition,
    relatedTypes,
    directReferences,
    totalReferences: primary.references?.length || 0,
    estimatedTokens,
  };
}
