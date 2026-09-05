import { LspRequest, LspResult, LspLocation, LspKind, LspLanguage } from "./lspTypes";
import { getDefinition, getReferences, getHover, getWorkspaceSymbols } from "./lspClient";
import * as path from "path";

function detectLanguage(file?: string): LspLanguage {
  if (!file) return "typescript";
  const ext = path.extname(file).toLowerCase();
  if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") return "typescript";
  if (ext === ".py") return "python";
  if (ext === ".go") return "go";
  if (ext === ".rs") return "rust";
  return "typescript";
}

function lspResultToLocations(result: any): LspLocation[] {
  if (!result?.result) return [];

  const items = Array.isArray(result.result) ? result.result : [result.result];
  return items
    .filter((item: any) => item?.uri)
    .map((item: any) => ({
      uri: item.uri,
      file: item.uri?.replace(/^file:\/\//, ""),
      line: item.range?.start?.line ?? item.line ?? 0,
      character: item.range?.start?.character ?? item.character ?? 0,
    }));
}

export async function handleLspRequest(request: LspRequest): Promise<LspResult> {
  const language = detectLanguage(request.file);
  const line = request.line ?? 0;
  const character = request.character ?? 0;

  try {
    switch (request.kind) {
      case "definition": {
        if (!request.symbol && !request.file) {
          return { ok: false, kind: request.kind, locations: [], error: "symbol or file+position required" };
        }
        const result = await getDefinition(language, request.file || "", line, character);
        const locations = lspResultToLocations(result);
        return { ok: locations.length > 0, kind: request.kind, locations };
      }

      case "references": {
        if (!request.symbol && !request.file) {
          return { ok: false, kind: request.kind, locations: [], error: "symbol or file+position required" };
        }
        const result = await getReferences(language, request.file || "", line, character);
        const locations = lspResultToLocations(result);
        return { ok: true, kind: request.kind, locations };
      }

      case "hover": {
        if (!request.file) {
          return { ok: false, kind: request.kind, locations: [], error: "file+position required" };
        }
        const result = await getHover(language, request.file, line, character);
        const hoverContent = result?.result?.contents?.value || result?.result?.contents?.join?.("\n") || "";
        return { ok: !!hoverContent, kind: request.kind, locations: [], hoverContent };
      }

      case "symbols": {
        const query = request.query || request.symbol || "";
        if (!query) {
          return { ok: false, kind: request.kind, locations: [], error: "query required" };
        }
        const result = await getWorkspaceSymbols(language, query);
        const locations = lspResultToLocations(result);
        return { ok: locations.length > 0, kind: request.kind, locations };
      }

      default:
        return { ok: false, kind: request.kind, locations: [], error: `Unsupported LSP kind: ${request.kind}` };
    }
  } catch (e: any) {
    return { ok: false, kind: request.kind, locations: [], error: e.message };
  }
}
