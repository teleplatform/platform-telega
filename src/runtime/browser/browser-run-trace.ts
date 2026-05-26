import type { BrowserTaskResult, BrowserStepResult, BrowserStep } from "./browser-types.js";

export interface TraceEvent {
  seq: number;
  kind: "plan_created" | "step_started" | "step_completed" | "step_failed" | "step_verified" | "step_unverified" | "screenshot_captured" | "task_completed" | "task_failed";
  label: string;
  detail: string;
  ts: number;
}

export interface RunTrace {
  planId: string;
  intent: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  allVerified: boolean;
  stepCount: number;
  failedCount: number;
  unverifiedCount: number;
  screenshotCount: number;
  events: TraceEvent[];
}

export function buildRunTrace(result: BrowserTaskResult): RunTrace {
  const events: TraceEvent[] = [];
  let seq = 0;

  events.push({ seq: ++seq, kind: "plan_created", label: result.intent, detail: `${result.stepResults.length} steps planned`, ts: result.startedAt });

  for (const sr of result.stepResults) {
    events.push({ seq: ++seq, kind: "step_started", label: sr.label, detail: `attempt ${sr.attempts}`, ts: result.startedAt + seq * 100 });

    if (sr.error) {
      events.push({ seq: ++seq, kind: "step_failed", label: sr.label, detail: sr.error, ts: result.completedAt });
    } else if (sr.verified) {
      const detailPieces: string[] = [];
      if (sr.actionResult.title) detailPieces.push(`title="${sr.actionResult.title}"`);
      if (sr.actionResult.url) detailPieces.push(`url=${sr.actionResult.url}`);
      if (sr.actionResult.elementFound !== undefined) detailPieces.push(`found=${sr.actionResult.elementFound}`);
      if (sr.actionResult.text) detailPieces.push(`text=${sr.actionResult.text.slice(0, 60)}...`);
      events.push({ seq: ++seq, kind: "step_completed", label: sr.label, detail: detailPieces.join(", "), ts: result.completedAt });
      events.push({ seq: ++seq, kind: "step_verified", label: sr.label, detail: `${sr.verificationResults.filter(v => v.passed).length}/${sr.verificationResults.length} checks passed`, ts: result.completedAt });
    } else {
      events.push({ seq: ++seq, kind: "step_completed", label: sr.label, detail: "completed", ts: result.completedAt });
      if (sr.verificationResults.length > 0) {
        const failed = sr.verificationResults.filter(v => !v.passed);
        events.push({ seq: ++seq, kind: "step_unverified", label: sr.label, detail: failed.map(v => `${v.condition.kind}=${v.condition.target}`).join("; "), ts: result.completedAt });
      }
    }

    if (sr.actionResult.screenshotPath) {
      events.push({ seq: ++seq, kind: "screenshot_captured", label: sr.label, detail: sr.actionResult.screenshotPath, ts: result.completedAt });
    }
  }

  if (result.screenshotPaths.length > 0) {
    for (const sp of result.screenshotPaths) {
      if (!events.some(e => e.kind === "screenshot_captured" && e.detail === sp)) {
        events.push({ seq: ++seq, kind: "screenshot_captured", label: "final", detail: sp, ts: result.completedAt });
      }
    }
  }

  events.push({
    seq: ++seq,
    kind: result.allVerified ? "task_completed" : "task_failed",
    label: result.intent,
    detail: result.allVerified ? "all steps verified" : `${result.stepResults.filter(s => !s.verified && !s.error).length} steps unverified`,
    ts: result.completedAt,
  });

  return {
    planId: result.planId,
    intent: result.intent,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    durationMs: result.completedAt - result.startedAt,
    allVerified: result.allVerified,
    stepCount: result.stepResults.length,
    failedCount: result.stepResults.filter(s => s.error).length,
    unverifiedCount: result.stepResults.filter(s => !s.verified && !s.error).length,
    screenshotCount: result.screenshotPaths.length,
    events,
  };
}

export function renderRunTrace(trace: RunTrace): string {
  const lines: string[] = [];
  const dur = (trace.durationMs / 1000).toFixed(1);
  lines.push(`Run Trace: ${trace.intent}`);
  lines.push(`  Duration: ${dur}s | Steps: ${trace.stepCount} | Verified: ${trace.allVerified ? "yes" : "no"}`);
  lines.push(`  Failed: ${trace.failedCount} | Unverified: ${trace.unverifiedCount} | Screenshots: ${trace.screenshotCount}`);
  lines.push("");

  for (const e of trace.events) {
    const icon: Record<string, string> = {
      plan_created: "📋",
      step_started: "▶️",
      step_completed: "✅",
      step_failed: "❌",
      step_verified: "🔍",
      step_unverified: "⚠️",
      screenshot_captured: "📸",
      task_completed: "🏁",
      task_failed: "💥",
    };
    lines.push(`  ${icon[e.kind] || "•"} [${e.seq}] ${e.label}: ${e.detail}`);
  }

  return lines.join("\n");
}
