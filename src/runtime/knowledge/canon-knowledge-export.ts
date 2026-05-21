import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons, getCanonsByCategory, type CanonCategory } from "./strategic-canon-registry.js";

export type ExportTarget = "mission_control" | "forge" | "telegpt" | "archives";

const EXPORT_DIR = path.join(process.cwd(), ".data", "canon-exports");

function getExportFilename(target: ExportTarget, format: "json" | "md"): string {
  const timestamp = Date.now();
  return `canon-${target}-${timestamp}.${format}`;
}

export function exportCanonRegistry(
  format: "json" | "md" = "json",
  target: ExportTarget = "archives",
): string {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const categories: CanonCategory[] = [
    "architecture", "governance", "safety", "federation",
    "recovery", "epistemic", "economy", "diplomacy",
  ];

  const filename = getExportFilename(target, format);
  const filePath = path.join(EXPORT_DIR, filename);
  let content: string;

  if (format === "json") {
    const data: Record<string, unknown> = {};
    for (const cat of categories) {
      data[cat] = getCanonsByCategory(cat).map((c) => ({
        id: c.canon_id,
        title: c.title,
        description: c.description,
        status: c.status,
        version: c.version,
        created_at: c.created_at,
        evidence_refs: c.evidence_refs,
      }));
    }
    data["active"] = getActiveCanons().length;
    data["_meta"] = { format, target, exported_at: new Date().toISOString() };
    content = JSON.stringify(data, null, 2);
  } else {
    const lines: string[] = [
      "# Strategic Canon Registry",
      `Export target: ${target}`,
      `Generated: ${new Date().toISOString()}`,
      "",
    ];
    for (const cat of categories) {
      const canons = getCanonsByCategory(cat);
      if (canons.length === 0) continue;
      lines.push(`## ${cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}`);
      lines.push("");
      for (const c of canons) {
        lines.push(`- **${c.title}** (v${c.version}, ${c.status})`);
        lines.push(`  ${c.description}`);
        lines.push("");
      }
    }
    content = lines.join("\n");
  }

  fs.writeFileSync(filePath, content, { encoding: "utf8" });

  appendEvidenceRecord({
    evidence_id: hashTraceId(`export_${Date.now()}`, "canon_export_created"),
    trace_id: `export_${Date.now()}`,
    job_id: "knowledge",
    type: "canon_export_created",
    timestamp: new Date().toISOString(),
    payload: { format, target, filename, path: filePath },
  });

  return filePath;
}
