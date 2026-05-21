import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendEvidenceRecord,
  initExecutionEvidenceStore,
  readEvidenceRecords,
} from "../../../src/runtime/evidence/execution-evidence-store.js";
import { hashTraceId } from "../../../src/runtime/evidence/execution-hash.js";
import { openIncident } from "../../../src/runtime/incidents/runtime-incident-command.js";
import {
  activatePlanningForRequest,
  aggregateMissionControlLiveFeed,
  autoCloseLowIncidentsAfterClosure,
  calculateBudgetBurnRate,
  checkBrowserActionGovernance,
  checkEvolutionProposalGovernance,
  checkFederationActionGovernance,
  checkFileOperationGovernance,
  checkLivingLoopEvidenceCompleteness,
  checkModelApiCallGovernance,
  checkRuntimeMode,
  checkShellExecutionGovernance,
  consumeRuntimeBudget,
  createRuntimeClosure,
  emitMissionControlLiveEvent,
  freezeLivingLoopBaseline,
  governRuntimeRoute,
  recordLivingLoopCompletenessGate,
  replayOperationalLoopTrace,
} from "../../../src/runtime/hooks/index.js";
import { maybeEscalateRuntimeIncident } from "../../../src/runtime/hooks/runtime-incident-auto-escalation-hook.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "living-loop-hardening-"));
const baselinePath = path.join(tempDir, "living-loop-baseline.json");
let fullTraceId = "";

async function appendExecutionCompleted(traceId: string): Promise<void> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "execution_completed"),
    trace_id: traceId,
    job_id: "test_execution",
    type: "execution_completed",
    timestamp: new Date().toISOString(),
    payload: { test: true },
  });
}

describe("A21-A28 operational hardening wave", () => {
  before(() => {
    initExecutionEvidenceStore(tempDir);
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("A21 covers living loop regression branches", async () => {
    const allowed = await governRuntimeRoute({
      route: "/chat",
      method: "POST",
      mode: "creator",
      request_id: "a21_allowed_chat",
      message_preview: "allowed chat branch",
    });
    assert.equal(allowed.decision, "allowed");
    fullTraceId = allowed.trace_id;

    const publicMode = await checkRuntimeMode({
      mode: "public",
      action: "shell",
      risk: "high",
      trace_id: hashTraceId("a21_public_mode", "runtime_mode"),
    });
    assert.equal(publicMode.decision, "blocked");

    const budgetExceeded = await consumeRuntimeBudget({
      action: "planning_action",
      units: 1_000,
      trace_id: hashTraceId("a21_budget_exceeded", "budget"),
    });
    assert.equal(budgetExceeded.allowed, false);

    const planningSkipped = await activatePlanningForRequest({
      request_text: "small request",
      route: "/chat",
      trace_id: hashTraceId("a21_planning_skipped", "planning"),
    });
    assert.equal(planningSkipped.decision, "skipped");

    const planningActivated = await activatePlanningForRequest({
      request_text: "Implement a multi-step architecture plan and roadmap. ".repeat(8),
      route: "/chat",
      trace_id: hashTraceId("a21_planning_activated", "planning"),
      force: true,
    });
    assert.equal(planningActivated.decision, "activated");

    await appendEvidenceRecord({
      evidence_id: hashTraceId("a21_failed_execution", "execution_failed"),
      trace_id: "a21_failed_execution",
      job_id: "test_execution",
      type: "execution_failed",
      timestamp: new Date().toISOString(),
      payload: { reason: "simulated failure" },
    });
    const incident = await maybeEscalateRuntimeIncident({
      kind: "execution_failed",
      description: "Simulated medium execution failed branch",
      trace_id: "a21_failed_execution",
      force: true,
      severity_hint: "medium",
    });
    assert.equal(incident.escalated, true);

    await appendExecutionCompleted(fullTraceId);
    const budget = await consumeRuntimeBudget({
      action: "api_call",
      trace_id: fullTraceId,
      mode: "creator",
    });
    assert.equal(budget.allowed, true);
    const closure = await createRuntimeClosure({ trace_id: fullTraceId, status: "success", route: "/chat" });
    assert.equal(closure.status, "success");
  });

  it("A22 requires preflight, decision, budget, execution, and closure records", async () => {
    const gate = await recordLivingLoopCompletenessGate(fullTraceId);
    assert.equal(gate.passed, true);
    assert.deepEqual(gate.missing, []);

    const incomplete = checkLivingLoopEvidenceCompleteness("missing_trace");
    assert.equal(incomplete.passed, false);
    assert.ok(incomplete.missing.includes("preflight"));
    assert.ok(incomplete.missing.includes("closure"));
  });

  it("A23 replays the operational loop by trace_id", async () => {
    const replay = await replayOperationalLoopTrace(fullTraceId);
    assert.equal(replay.passed, true);
    assert.ok(replay.events.some((event) => event.type === "chat_route_preflight_started"));
    assert.ok(replay.events.some((event) => event.type === "runtime_closure_completed"));
  });

  it("A24 aggregates Mission Control live feed events", async () => {
    await emitMissionControlLiveEvent({
      kind: "execution_completed",
      severity: "info",
      title: "Living loop hardening test event",
      trace_id: fullTraceId,
    });
    const feed = aggregateMissionControlLiveFeed(10);
    assert.ok(feed.some((item) => item.trace_id === fullTraceId && item.kind === "execution_completed"));
  });

  it("A25 checks runtime mode matrix for public/creator surfaces", async () => {
    const publicShell = await checkShellExecutionGovernance({
      command: "ls",
      requested_by: "system",
      trace_id: hashTraceId("a25_public_shell", "shell"),
    });
    assert.equal(publicShell.decision, "blocked");

    const creatorShell = await checkShellExecutionGovernance({
      command: "ls",
      requested_by: "manual",
      trace_id: hashTraceId("a25_creator_shell", "shell"),
    });
    assert.equal(creatorShell.decision, "allowed");

    const publicFile = await checkFileOperationGovernance({
      kind: "delete",
      path: path.join(process.cwd(), "tmp-public-delete.txt"),
      requested_by: "system",
      trace_id: hashTraceId("a25_public_file", "file"),
    });
    assert.equal(publicFile.decision, "blocked");

    const creatorFile = await checkFileOperationGovernance({
      kind: "read",
      path: path.join(process.cwd(), "package.json"),
      requested_by: "manual",
      trace_id: hashTraceId("a25_creator_file", "file"),
    });
    assert.equal(creatorFile.decision, "allowed");

    const publicFederation = await checkFederationActionGovernance({
      kind: "register_runtime",
      requested_by: "system",
      trace_id: hashTraceId("a25_public_federation", "federation"),
    });
    assert.equal(publicFederation.decision, "blocked");

    const creatorFederation = await checkFederationActionGovernance({
      kind: "capability_exchange",
      requested_by: "manual",
      trace_id: hashTraceId("a25_creator_federation", "federation"),
    });
    assert.notEqual(creatorFederation.decision, "blocked");

    const publicEvolution = await checkEvolutionProposalGovernance({
      kind: "evolution",
      requested_by: "system",
      trace_id: hashTraceId("a25_public_evolution", "evolution"),
    });
    assert.equal(publicEvolution.decision, "blocked");

    const creatorEvolution = await checkEvolutionProposalGovernance({
      kind: "pack_generation",
      requested_by: "manual",
      trace_id: hashTraceId("a25_creator_evolution", "evolution"),
    });
    assert.notEqual(creatorEvolution.decision, "blocked");

    const modelCall = await checkModelApiCallGovernance({
      provider: "local",
      model: "test",
      mode: "public",
      trace_id: hashTraceId("a25_model_call", "model_api"),
    });
    assert.equal(modelCall.decision, "allowed");

    const browser = await checkBrowserActionGovernance({
      kind: "dom_read",
      url: "http://localhost:3000",
      requested_by: "system",
      trace_id: hashTraceId("a25_browser_dom_read", "browser"),
    });
    assert.equal(browser.decision, "allowed");
  });

  it("A26 calculates budget burn rate and anomalies", () => {
    const report = calculateBudgetBurnRate(60);
    assert.ok(report.window_minutes === 60);
    assert.ok(report.total_consumed >= 0);
    assert.ok(Array.isArray(report.anomalies));
    assert.ok(report.budgets.length > 0);
  });

  it("A27 auto-closes low incidents after successful closure", async () => {
    const lowIncident = await openIncident(
      "Minor living loop test incident",
      "minor notice",
      ["living_loop"],
      "low",
    );
    const result = await autoCloseLowIncidentsAfterClosure({
      trace_id: fullTraceId,
      closure_status: "success",
    });
    assert.ok(result.closed_incident_ids.includes(lowIncident.incident_id));
  });

  it("A28 freezes the living loop baseline artifact", async () => {
    const baseline = await freezeLivingLoopBaseline({ trace_id: fullTraceId, output_path: baselinePath });
    assert.equal(baseline.status, "frozen");
    assert.equal(baseline.milestone, "A28");
    assert.equal(baseline.completeness_gate.passed, true);
    assert.equal(fs.existsSync(baselinePath), true);

    const written = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    assert.equal(written.artifact_id, "living_loop_baseline");
    assert.equal(written.replay.passed, true);

    const records = readEvidenceRecords({ trace_id: fullTraceId });
    assert.ok(records.some((record) => record.type === "operational_baseline_frozen"));
  });
});
