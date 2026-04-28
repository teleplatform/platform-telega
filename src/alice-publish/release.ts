// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Release Summary
//
// Does NOT auto-publish. Collects publish bundle metadata,
// forms readiness summary, truthfully shows blockers/warnings/notes.
// ─────────────────────────────────────────────────────────────

import type {
  AliceReleaseSummary,
  AlicePublishReadinessReport,
  AliceSkillManifest,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildAliceReleaseSummary(input: {
  skillId: string;
  version: string;
  readiness: AlicePublishReadinessReport;
  manifest?: AliceSkillManifest;
  endpointPath?: string;
}): AliceReleaseSummary {
  const blockers = input.readiness.blockers ?? [];
  const warnings = input.readiness.warnings ?? [];
  const notes = input.readiness.notes ?? [];

  if (input.readiness.readyToPublish) {
    notes.push("All structural checks passed — skill is launch-ready");
  } else {
    blockers.push("Skill is not ready for external publication");
  }

  return {
    skillId: input.skillId,
    version: input.version,
    readyToPublish: input.readiness.readyToPublish,
    manifestPath: input.manifest ? "configs/alice-skill.manifest.json" : undefined,
    endpointPath: input.endpointPath,
    blockers,
    warnings,
    notes,
    generatedAt: nowIso(),
  };
}

export function formatReleaseSummary(summary: AliceReleaseSummary): string {
  const lines: string[] = [];

  lines.push(`Alice Skill Release Summary`);
  lines.push(`==========================`);
  lines.push(`Skill: ${summary.skillId}`);
  lines.push(`Version: ${summary.version}`);
  lines.push(`Ready to Publish: ${summary.readyToPublish ? "YES" : "NO"}`);
  lines.push(``);

  if (summary.manifestPath) {
    lines.push(`Manifest: ${summary.manifestPath}`);
  }
  if (summary.endpointPath) {
    lines.push(`Endpoint: ${summary.endpointPath}`);
  }

  if (summary.blockers.length > 0) {
    lines.push(``);
    lines.push(`BLOCKERS (${summary.blockers.length}):`);
    for (const b of summary.blockers) {
      lines.push(`  ✗ ${b}`);
    }
  }

  if (summary.warnings.length > 0) {
    lines.push(``);
    lines.push(`WARNINGS (${summary.warnings.length}):`);
    for (const w of summary.warnings) {
      lines.push(`  ⚠ ${w}`);
    }
  }

  if (summary.notes.length > 0) {
    lines.push(``);
    lines.push(`NOTES:`);
    for (const n of summary.notes) {
      lines.push(`  • ${n}`);
    }
  }

  lines.push(``);
  lines.push(`Generated: ${summary.generatedAt}`);

  return lines.join("\n");
}
