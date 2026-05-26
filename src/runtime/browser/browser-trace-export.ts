import type { BrowserTaskResult, BrowserStepResult } from "./browser-types.js";
import { classifyTaskEffect } from "./browser-effect-classifier.js";
import { buildRunTrace } from "./browser-run-trace.js";
import { getEvidenceByTrace } from "../evidence/execution-evidence-store.js";
import type { ExecutionEvidenceRecord } from "../evidence/execution-evidence.types.js";

export interface ExportedBrowserTrace {
  exportedAt: string;
  version: string;
  planId: string;
  intent: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  allVerified: boolean;
  effect: string;
  impact: string;
  stepCount: number;
  failedCount: number;
  unverifiedCount: number;
  screenshotCount: number;
  evidenceRecords: number;
  artifacts: {
    stepLabel: string;
    url?: string;
    title?: string;
    elementFound?: boolean;
    textLength?: number;
    screenshotPath?: string;
    error?: string;
    verified: boolean;
    verificationResults: { kind: string; target: string; passed: boolean }[];
  }[];
  evidenceDetail: ExecutionEvidenceRecord[];
  timeline: { seq: number; kind: string; label: string; detail: string }[];
}

export function exportBrowserTrace(result: BrowserTaskResult): ExportedBrowserTrace {
  const trace = buildRunTrace(result);
  const { primary, impactSummary } = classifyTaskEffect(result);
  const evidenceRecords = getEvidenceByTrace(`brw_trace_${result.planId}`);

  return {
    exportedAt: new Date().toISOString(),
    version: "rc37-v1",
    planId: result.planId,
    intent: result.intent,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    durationMs: result.completedAt - result.startedAt,
    allVerified: result.allVerified,
    effect: primary,
    impact: impactSummary,
    stepCount: result.stepResults.length,
    failedCount: result.stepResults.filter(s => s.error).length,
    unverifiedCount: result.stepResults.filter(s => !s.verified && !s.error).length,
    screenshotCount: result.screenshotPaths.length,
    evidenceRecords: evidenceRecords.length,
    artifacts: result.stepResults.map(sr => ({
      stepLabel: sr.label,
      url: sr.actionResult.url,
      title: sr.actionResult.title,
      elementFound: sr.actionResult.elementFound,
      textLength: sr.actionResult.text?.length,
      screenshotPath: sr.actionResult.screenshotPath,
      error: sr.error,
      verified: sr.verified,
      verificationResults: sr.verificationResults.map(v => ({
        kind: v.condition.kind,
        target: v.condition.target,
        passed: v.passed,
      })),
    })),
    evidenceDetail: evidenceRecords,
    timeline: trace.events.map(e => ({
      seq: e.seq,
      kind: e.kind,
      label: e.label,
      detail: e.detail,
    })),
  };
}

export function exportTraceToJSON(result: BrowserTaskResult, pretty = true): string {
  return JSON.stringify(exportBrowserTrace(result), null, pretty ? 2 : undefined);
}
