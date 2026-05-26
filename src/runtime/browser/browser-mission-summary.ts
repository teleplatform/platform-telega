import type { BrowserTaskResult } from "./browser-types.js";
import { classifyTaskEffect } from "./browser-effect-classifier.js";
import { buildRunTrace, renderRunTrace } from "./browser-run-trace.js";
import { emitMissionControlLiveEvent } from "../hooks/mission-control-live-feed-hook.js";

export function createMissionSummary(result: BrowserTaskResult): string {
  const trace = buildRunTrace(result);
  const { primary, impactSummary } = classifyTaskEffect(result);
  const dur = ((result.completedAt - result.startedAt) / 1000).toFixed(1);

  const lines: string[] = [];
  lines.push(`╔══════════════════════════════════════════╗`);
  lines.push(`║     Browser Task — Mission Summary      ║`);
  lines.push(`╚══════════════════════════════════════════╝`);
  lines.push(``);
  lines.push(`  Intent:       ${result.intent}`);
  lines.push(`  Plan ID:      ${result.planId}`);
  lines.push(`  Duration:     ${dur}s`);
  lines.push(`  Status:       ${result.allVerified ? "✅ ALL VERIFIED" : "⚠️ VERIFICATION FAILED"}`);
  lines.push(`  Effect:       ${primary}`);
  lines.push(`  Impact:       ${impactSummary}`);
  lines.push(``);
  lines.push(`  Steps:        ${result.stepResults.length}`);
  lines.push(`   - Passed:    ${result.stepResults.filter(s => !s.error && s.verified).length}`);
  lines.push(`   - Unverified: ${result.stepResults.filter(s => !s.error && !s.verified).length}`);
  lines.push(`   - Failed:    ${result.stepResults.filter(s => s.error).length}`);
  lines.push(`  Screenshots:  ${result.screenshotPaths.length}`);
  lines.push(``);

  for (const sr of result.stepResults) {
    const icon = sr.error ? "❌" : sr.verified ? "✅" : "⚠️";
    const detail = sr.error ? sr.error : sr.actionResult.title || `found=${sr.actionResult.elementFound}` || `${sr.actionResult.text?.length ?? 0} chars`;
    lines.push(`  ${icon} ${sr.label}: ${detail.slice(0, 100)}`);
    for (const v of sr.verificationResults) {
      lines.push(`     verify ${v.passed ? "✅" : "❌"}: ${v.condition.kind} ${v.condition.target}`);
    }
  }

  if (result.screenshotPaths.length > 0) {
    lines.push(``);
    lines.push(`  Screenshots:`);
    for (const sp of result.screenshotPaths) {
      lines.push(`   📸 ${sp}`);
    }
  }

  lines.push(``);
  lines.push(renderRunTrace(trace));

  return lines.join("\n");
}

export async function emitBrowserMissionEvent(result: BrowserTaskResult): Promise<void> {
  const trace = buildRunTrace(result);
  const { primary } = classifyTaskEffect(result);
  const dur = ((result.completedAt - result.startedAt) / 1000).toFixed(1);

  await emitMissionControlLiveEvent({
    kind: result.allVerified ? "execution_completed" : "execution_failed",
    severity: result.allVerified ? "low" : result.stepResults.some(s => s.error) ? "high" : "medium",
    title: `Browser: ${result.intent} (${dur}s, ${result.stepResults.length} steps, ${result.screenshotPaths.length} screenshots)`,
    trace_id: `brw_${result.planId}`,
    payload: {
      planId: result.planId,
      allVerified: result.allVerified,
      stepCount: result.stepResults.length,
      failedCount: result.stepResults.filter(s => s.error).length,
      screenshotCount: result.screenshotPaths.length,
      effect: primary,
      durationMs: result.completedAt - result.startedAt,
    },
  });
}
