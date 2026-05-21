import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActivePlans } from "./strategic-planning-engine.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

const ARCHIVE_DIR = path.join(process.cwd(), ".data", "plan-archives");

export function exportPlanArchive(
  planId: string,
  format: "json" | "md" = "json",
): string {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  const plans = getActivePlans();
  const plan = plans.find((p) => p.plan_id === planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const evidence = readEvidenceRecords();
  const planEvidence = evidence.filter((e) => e.payload?.plan_id === planId || e.trace_id === planId);

  const filename = `plan-archive-${planId}-${Date.now()}.${format}`;
  const filePath = path.join(ARCHIVE_DIR, filename);

  let content: string;

  if (format === "json") {
    content = JSON.stringify({
      plan: {
        id: plan.plan_id,
        title: plan.title,
        description: plan.description,
        phases: plan.phases,
        priority: plan.priority,
        status: plan.status,
        dependencies: plan.dependencies,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
      },
      evidence_count: planEvidence.length,
      evidence_types: [...new Set(planEvidence.map((e) => e.type))],
      exported_at: new Date().toISOString(),
    }, null, 2);
  } else {
    const lines: string[] = [
      "# Plan Archive",
      "",
      `## ${plan.title}`,
      `**ID:** ${plan.plan_id}`,
      `**Status:** ${plan.status}`,
      `**Priority:** ${plan.priority}`,
      `**Created:** ${plan.created_at}`,
      "",
      "### Description",
      plan.description,
      "",
      "### Phases",
      ...plan.phases.map((p, i) => `${i + 1}. ${p}`),
      "",
      `### Evidence Records: ${planEvidence.length}`,
      ...planEvidence.map((e) => `- ${e.type} (${e.timestamp})`),
    ];
    content = lines.join("\n");
  }

  fs.writeFileSync(filePath, content, { encoding: "utf8" });

  appendEvidenceRecord({
    evidence_id: hashTraceId(`archive_${planId}`, "plan_archive_export_created"),
    trace_id: `archive_${planId}`,
    job_id: "planning",
    type: "plan_archive_export_created",
    timestamp: new Date().toISOString(),
    payload: {
      plan_id: planId,
      format,
      path: filePath,
      evidence_count: planEvidence.length,
    },
  });

  return filePath;
}
