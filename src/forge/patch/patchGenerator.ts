import { PatchProposal, PatchChunk, PatchRisk } from "./patchTypes";
import * as path from "path";
import * as crypto from "crypto";

let counter = 0;
function generateId(): string {
  counter++;
  return `patch_${Date.now()}_${counter}`;
}

function generateNullCheckChunk(
  file: string,
  line: number,
  varName: string
): PatchChunk {
  const tab = "  ";
  return {
    file,
    line,
    original: "",
    patched: `${tab}if (${varName} == null) {\n${tab}  throw new Error('${varName} is required');\n${tab}}\n`,
    description: `Add null check for \`${varName}\` at ${path.basename(file)}:${line}`,
  };
}

function generateValidationChunk(
  file: string,
  line: number,
  varName: string
): PatchChunk {
  const tab = "  ";
  const capName = varName.charAt(0).toUpperCase() + varName.slice(1);
  return {
    file,
    line,
    original: "",
    patched: `${tab}function validate${capName}(value: unknown): asserts value is string {\n${tab}  if (typeof value !== 'string' || value.length === 0) {\n${tab}    throw new Error('${varName} must be a non-empty string');\n${tab}  }\n${tab}}\n`,
    description: `Add validation guard for \`${varName}\` at ${path.basename(file)}:${line}`,
  };
}

function generateTypeGuardChunk(
  file: string,
  line: number
): PatchChunk {
  const tab = "  ";
  return {
    file,
    line,
    original: "",
    patched: `${tab}if (typeof value !== 'expected') {\n${tab}  throw new TypeError('Unexpected type: ' + typeof value);\n${tab}}\n`,
    description: `Add runtime type guard at ${path.basename(file)}:${line}`,
  };
}

function generateErrorBoundaryChunk(
  file: string,
  line: number,
  symbolName: string
): PatchChunk {
  return {
    file,
    line,
    original: "",
    patched: `try {\n  // existing ${symbolName} logic\n} catch (error) {\n  console.error('${symbolName} failed:', error);\n  throw error;\n}`,
    description: `Add error boundary around ${symbolName} at ${path.basename(file)}:${line}`,
  };
}

function assessRisk(
  file: string,
  symbol: string,
  chunks: PatchChunk[]
): { risk: PatchRisk; reason: string } {
  const fileLower = file.toLowerCase();
  const symbolLower = symbol.toLowerCase();

  // Critical risk patterns
  if (fileLower.includes("migration") || fileLower.includes("schema")) {
    return { risk: "critical", reason: "Schema/migration change — requires manual review" };
  }
  if (symbolLower.includes("payment") || symbolLower.includes("auth") || symbolLower.includes("security")) {
    return { risk: "high", reason: "Payment/auth/sensitive symbol — moderate risk" };
  }

  // High risk patterns
  if (fileLower.includes("controller") || fileLower.includes("middleware")) {
    return { risk: "medium", reason: "Controller/middleware — moderate impact" };
  }

  // Medium risk
  if (chunks.length > 2) {
    return { risk: "medium", reason: `${chunks.length} chunks — broader change` };
  }

  // Check chunk categories
  const categories = chunks.map((c) => c.description);
  if (categories.some((c) => c.includes("null check") || c.includes("type guard"))) {
    return { risk: "low", reason: "Null check / type guard — safe additive change" };
  }

  return { risk: "medium", reason: "General logic change" };
}

export function generatePatch(
  symbol: string,
  rootCause: string,
  file: string,
  line: number,
  fixContext: {
    nullVars?: string[];
    typeError?: boolean;
    symbolName?: string;
  }
): PatchProposal {
  const chunks: PatchChunk[] = [];

  if (fixContext.nullVars) {
    for (const v of fixContext.nullVars) {
      chunks.push(generateNullCheckChunk(file, line, v));
      chunks.push(generateValidationChunk(file, line, v));
    }
  }

  if (fixContext.typeError && !fixContext.nullVars?.length) {
    chunks.push(generateTypeGuardChunk(file, line));
  }

  // Always add error boundary
  chunks.push(generateErrorBoundaryChunk(file, line, fixContext.symbolName || symbol));

  const { risk, reason } = assessRisk(file, symbol, chunks);

  const estimatedImpact = [...new Set(chunks.map((c) => c.file))];

  return {
    id: generateId(),
    symbol,
    rootCause,
    risk,
    riskReason: reason,
    chunks,
    estimatedImpact,
    generatedAt: Date.now(),
  };
}
