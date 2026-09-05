import { PatchRisk } from "./patchTypes";
import { PatchChunk } from "./patchTypes";

export function assessPatchRisk(
  chunks: PatchChunk[],
  symbol: string,
  file: string
): { risk: PatchRisk; reason: string } {
  const fileLower = file.toLowerCase();
  const symbolLower = symbol.toLowerCase();

  // Check additive-only changes first — safe regardless of file/symbol name
  const allAdditive = chunks.every(
    (c) => c.description.includes("null check") || c.description.includes("type guard") || c.description.includes("validation") || c.description.includes("error boundary")
  );
  if (allAdditive) {
    return { risk: "low", reason: "Additive changes only (null checks, guards) — safe" };
  }

  if (fileLower.includes("migration") || fileLower.includes("schema")) {
    return { risk: "critical", reason: "Schema/migration change — requires manual review" };
  }
  const securitySymbols = ["payment", "security", "password", "token", "apikey", "apisecret", "credential"];
  const securityFiles = ["/auth/", "/authenticate", "/authorize"];
  if (securitySymbols.some((s) => symbolLower.includes(s)) ||
      securityFiles.some((s) => fileLower.includes(s))) {
    return { risk: "high", reason: "Security/sensitive symbol — high impact potential" };
  }
  if (fileLower.includes("controller") || fileLower.includes("middleware") || fileLower.includes("handler")) {
    return { risk: "medium", reason: "Request handler — moderate impact" };
  }
  if (chunks.length > 3) {
    return { risk: "medium", reason: `${chunks.length} chunks — broader than average change` };
  }

  return { risk: "medium", reason: "General logic adjustment" };
}
