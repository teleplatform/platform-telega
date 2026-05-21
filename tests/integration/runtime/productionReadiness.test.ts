import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendEvidenceRecord,
  initExecutionEvidenceStore,
} from "../../../src/runtime/evidence/execution-evidence-store.js";
import { hashTraceId } from "../../../src/runtime/evidence/execution-hash.js";
import {
  auditBudgetConsistency,
  auditModeBoundaries,
  buildGovernanceFailureMatrix,
  checkBrowserActionGovernance,
  checkFederationActionGovernance,
  checkFileOperationGovernance,
  checkReplayGovernanceHardening,
  checkShellExecutionGovernance,
  consumeRuntimeBudget,
  createRuntimeClosure,
  emitMissionControlLiveEvent,
  freezeProductionActivation,
  governRuntimeRoute,
  inspectOperationalLoopTrace,
  maybeEscalateRuntimeIncident,
  aggregateMissionControlLiveFeed,
} from "../../../src/runtime/hooks/index.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "production-readiness-"));
const productionFreezePath = path.join(tempDir, "production-activation-freeze.json");
let traceId = "";

async function createCompleteLivingTrace(): Promise<string> {
  const route = await governRuntimeRoute({
    route: "/chat",
    method: "POST",
    mode: "creator",
    request_id: "production_readiness_living_trace",
    message_preview: "production readiness living loop trace",
  });
  assert.equal(route.decision, "allowed");

  const budget = await consumeRuntimeBudget({
    action: "api_call",
    trace_id: route.trace_id,
    mode: "creator",
  });
  assert.equal(budget.allowed, true);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(route.trace_id, "execution_completed"),
    trace_id: route.trace_id,
    job_id: "production_readiness",
    type: "execution_completed",
    timestamp: new Date().toISOString(),
    payload: { ok: true },
  });

  const closure = await createRuntimeClosure({
    trace_id: route.trace_id,
    status: "success",
    route: "/chat",
  });
  assert.equal(closure.status, "success");
  return route.trace_id;
}

describe("A29-A36 production readiness wave", () => {
  before(async () => {
    initExecutionEvidenceStore(tempDir);
    traceId = await createCompleteLivingTrace();
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("A30 inspects operational loop trace phases", () => {
    const inspection = inspectOperationalLoopTrace(traceId);
    assert.equal(inspection.complete, true);
    assert.deepEqual(inspection.missing, []);
    assert.deepEqual(inspection.phases.map((phase) => phase.phase), [
      "preflight",
      "decision_point",
      "budget",
      "execution",
      "closure",
    ]);
  });

  it("A31 builds governance failure matrix across surfaces", async () => {
    await checkShellExecutionGovernance({
      command: "ls",
      requested_by: "system",
      trace_id: hashTraceId("a31_shell_blocked", "shell"),
    });
    await checkFileOperationGovernance({
      kind: "delete",
      path: path.join(process.cwd(), "tmp-a31-delete.txt"),
      requested_by: "system",
      trace_id: hashTraceId("a31_file_blocked", "file"),
    });
    await checkBrowserActionGovernance({
      kind: "submit",
      url: "https://example.com/checkout",
      value_preview: "payment submit",
      requested_by: "manual",
      trace_id: hashTraceId("a31_browser_approval", "browser"),
    });
    await checkReplayGovernanceHardening({
      trace_id: "missing_trace_for_replay",
      requested_by: "manual",
    });
    await checkFederationActionGovernance({
      kind: "register_runtime",
      requested_by: "system",
      trace_id: hashTraceId("a31_federation_blocked", "federation"),
    });

    const matrix = buildGovernanceFailureMatrix();
    assert.equal(matrix.length, 7);
    assert.ok(matrix.find((row) => row.surface === "shell")!.blocked >= 1);
    assert.ok(matrix.find((row) => row.surface === "browser")!.requires_approval >= 1);
    assert.ok(matrix.find((row) => row.surface === "federation")!.blocked >= 1);
  });

  it("A32 audits budget consistency across risky paths", () => {
    const audit = auditBudgetConsistency();
    assert.equal(audit.passed, true);
    assert.equal(audit.failures.length, 0);
    assert.ok(audit.paths.every((item) => item.budget_gate.length > 0));
  });

  it("A33 audits mode boundaries", () => {
    const audit = auditModeBoundaries();
    assert.equal(audit.passed, true);
    assert.ok(audit.boundaries.some((item) => item.surface === "shell" && item.public_expected === "blocked"));
    assert.ok(audit.boundaries.some((item) => item.surface === "model_api" && item.public_expected === "allowed"));
  });

  it("A34 covers incident regression signals", async () => {
    const executionFailure = await maybeEscalateRuntimeIncident({
      kind: "execution_failed",
      description: "production readiness execution failed regression",
      trace_id: hashTraceId("a34_execution_failed", "incident"),
      force: true,
      severity_hint: "medium",
    });
    const governanceBlocked = await maybeEscalateRuntimeIncident({
      kind: "governance_blocked",
      description: "production readiness governance blocked regression",
      trace_id: hashTraceId("a34_governance_blocked", "incident"),
      force: true,
      severity_hint: "medium",
    });
    const budgetExceeded = await maybeEscalateRuntimeIncident({
      kind: "budget_exhausted",
      description: "production readiness budget exceeded regression",
      trace_id: hashTraceId("a34_budget_exceeded", "incident"),
      severity_hint: "medium",
    });
    const driftEscalated = await maybeEscalateRuntimeIncident({
      kind: "drift_escalated",
      description: "production readiness drift escalated regression",
      trace_id: hashTraceId("a34_drift_escalated", "incident"),
      force: true,
      severity_hint: "high",
    });

    assert.equal(executionFailure.escalated, true);
    assert.equal(governanceBlocked.escalated, true);
    assert.equal(budgetExceeded.escalated, true);
    assert.equal(driftEscalated.escalated, true);
  });

  it("A35 verifies important events enter Mission Control feed", async () => {
    await emitMissionControlLiveEvent({
      kind: "budget_pressure",
      severity: "medium",
      title: "Production readiness budget pressure",
      trace_id: traceId,
    });
    const feed = aggregateMissionControlLiveFeed(20);
    assert.ok(feed.some((item) => item.trace_id === traceId && item.kind === "budget_pressure"));
  });

  it("A36 freezes production activation readiness", async () => {
    const freeze = await freezeProductionActivation({
      trace_id: traceId,
      output_path: productionFreezePath,
    });
    assert.equal(freeze.status, "frozen");
    assert.equal(freeze.milestone, "A36");
    assert.equal(freeze.production_ready, true);
    assert.equal(fs.existsSync(productionFreezePath), true);

    const written = JSON.parse(fs.readFileSync(productionFreezePath, "utf8"));
    assert.equal(written.artifact_id, "production_activation_freeze");
    assert.equal(written.production_ready, true);
  });
});
