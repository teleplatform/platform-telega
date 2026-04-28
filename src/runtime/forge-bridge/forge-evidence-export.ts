// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE EXPORT v1
//
// Export layer for evidence records.
// Formats: json, jsonl, summary text.
// ─────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type {
  ForgeEvidenceExportFormat,
  ForgeEvidenceQuery,
  ForgeEvidenceExportResult,
} from "./forge-evidence-export.types.js";
import type { ForgeInvocationEvidenceRecord } from "./forge-invocation-evidence.types.js";
import { listEvidenceFromStore } from "./forge-evidence-store.js";
import { buildForgeInvocationAuditLine } from "./forge-invocation-audit.js";

export async function exportEvidence(
  query: ForgeEvidenceQuery,
  format: ForgeEvidenceExportFormat,
  outputPath?: string,
): Promise<ForgeEvidenceExportResult> {
  try {
    const records = await listEvidenceFromStore(query);

    if (records.length === 0) {
      return {
        ok: true,
        format,
        count: 0,
        output: "",
      };
    }

    let output: string;
    let filePath: string | undefined;

    switch (format) {
      case "json":
        output = JSON.stringify(records, null, 2);
        break;

      case "jsonl":
        output = records.map((r) => JSON.stringify(r)).join("\n");
        break;

      case "summary":
        output = buildSummaryText(records);
        break;

      default:
        return {
          ok: false,
          format,
          count: 0,
          error: `Unknown format: ${format}`,
        };
    }

    if (outputPath) {
      const dir = join(outputPath, "..");
      if (!mkdirSync && !require("node:fs").existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(outputPath, output, { encoding: "utf8" });
      filePath = outputPath;
    }

    console.log(`[evidence-export] exported ${records.length} records format=${format}`);

    return {
      ok: true,
      format,
      count: records.length,
      output: format !== "json" ? output : undefined,
      filePath,
    };
  } catch (e: any) {
    return {
      ok: false,
      format,
      count: 0,
      error: e.message,
    };
  }
}

function buildSummaryText(records: ForgeInvocationEvidenceRecord[]): string {
  const lines: string[] = [
    `=== Forge Evidence Export (${records.length} records) ===`,
    "",
  ];

  for (const record of records) {
    const line = buildForgeInvocationAuditLine(record);
    lines.push(line);

    if (record.renderedText) {
      lines.push(`  rendered: ${record.renderedText}`);
    }

    if (record.blockedReason) {
      lines.push(`  reason: ${record.blockedReason}`);
    }

    if (record.errorCode) {
      lines.push(`  error: ${record.errorCode} - ${record.errorMessage}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

export async function exportEvidenceByUser(
  userId: string,
  format: ForgeEvidenceExportFormat = "jsonl",
): Promise<ForgeEvidenceExportResult> {
  return exportEvidence({ userId }, format);
}

export async function exportEvidenceByTask(
  taskId: string,
  format: ForgeEvidenceExportFormat = "json",
): Promise<ForgeEvidenceExportResult> {
  return exportEvidence({ taskId }, format);
}

export async function exportBlockedEvidence(
  outputPath?: string,
): Promise<ForgeEvidenceExportResult> {
  return exportEvidence({ status: "blocked" }, "summary", outputPath);
}

export async function exportFailedEvidence(
  outputPath?: string,
): Promise<ForgeEvidenceExportResult> {
  return exportEvidence({ status: "failed" }, "summary", outputPath);
}

export async function exportRecentEvidence(
  limit: number = 20,
  format: ForgeEvidenceExportFormat = "summary",
): Promise<ForgeEvidenceExportResult> {
  return exportEvidence({ limit, orderBy: "startedAt", order: "desc" }, format);
}