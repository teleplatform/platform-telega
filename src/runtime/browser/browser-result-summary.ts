import type { BrowserTaskResult } from "./browser-types.js";

export function summarizeTaskResult(result: BrowserTaskResult, includeEvidence = false): string {
  const lines: string[] = [];
  const duration = ((result.completedAt - result.startedAt) / 1000).toFixed(1);

  lines.push(`📋 Browser Task: ${result.intent}`);
  lines.push(`⏱ Duration: ${duration}s`);
  lines.push(`✅ All verified: ${result.allVerified ? "yes" : "no"}`);

  for (const sr of result.stepResults) {
    const icon = sr.error ? "❌" : sr.verified ? "✅" : "⚠️";
    lines.push("");
    lines.push(`  ${icon} Step: ${sr.label}`);
    if (sr.error) {
      lines.push(`     Error: ${sr.error}`);
    } else {
      if (sr.actionResult.title) lines.push(`     Title: ${sr.actionResult.title}`);
      if (sr.actionResult.url) lines.push(`     URL: ${sr.actionResult.url}`);
      if (sr.actionResult.elementFound !== undefined) lines.push(`     Found: ${sr.actionResult.elementFound}`);
      if (sr.actionResult.text && sr.actionResult.text.length < 200) lines.push(`     Text: ${sr.actionResult.text}`);
      if (sr.actionResult.text && sr.actionResult.text.length >= 200) lines.push(`     Text: ${sr.actionResult.text.slice(0, 200)}...`);
    }
    if (sr.verificationResults.length > 0) {
      for (const v of sr.verificationResults) {
        lines.push(`     Verify ${v.passed ? "✅" : "❌"}: ${v.condition.kind}=${v.condition.target} (actual: ${v.actual.slice(0, 80)})`);
      }
    }
    if (includeEvidence && sr.evidence.length > 0) {
      for (const e of sr.evidence) {
        if (e.path) lines.push(`     Evidence: ${e.path}`);
      }
    }
  }

  if (result.screenshotPaths.length > 0) {
    lines.push("");
    lines.push("📸 Screenshots:");
    for (const sp of result.screenshotPaths) {
      lines.push(`  ${sp}`);
    }
  }

  return lines.join("\n");
}
