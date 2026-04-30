import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createFeedbackEventsRepo, createExecutionOutcomesRepo, createFeedbackAggregatesRepo, buildSessionSummary, buildRouteSummary } from "../../packages/runtime-feedback-core/src/storage/sqlite/feedbackRepo.js";
import { createFeedbackApi } from "../../packages/runtime-feedback-core/src/api/feedbackApi.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => { passed++; console.log(`  ✓ ${name}`); }).catch((e) => { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); });
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

async function runTests() {
  const db = new Database(":memory:");
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-feedback-core/src/storage/sqlite/schema.sql");
  db.exec(readFileSync(schemaPath, "utf-8"));

  const eventsRepo = createFeedbackEventsRepo(db);
  const outcomesRepo = createExecutionOutcomesRepo(db);
  const aggregatesRepo = createFeedbackAggregatesRepo(db);
  const feedbackApi = createFeedbackApi({
    eventsRepo,
    outcomesRepo,
    aggregatesRepo,
    buildSessionSummary,
    buildRouteSummary,
  });

  console.log("\nIntegration: Feedback Record Execution Success:");

  await test("execution success outcome recorded", () => {
    const result = feedbackApi.recordExecutionOutcome({
      session_id: "sess_1",
      trace_id: "trace_1",
      route_id: "route_1",
      transport: "telegram",
      outcome: "success",
      duration_ms: 1500,
    });
    assert.ok(result.recorded);
    assert.ok(result.outcome_id.startsWith("outcome_"));
  });

  await test("success event visible in session summary", () => {
    feedbackApi.recordExecutionOutcome({ session_id: "sess_2", outcome: "success" });
    const summary = feedbackApi.getSessionFeedbackSummary("sess_2");
    assert.equal(summary.success_count, 1);
    assert.equal(summary.total_events, 1);
  });

  console.log("\nIntegration: Feedback Record Execution Failure:");

  await test("execution failure outcome recorded with reason code", () => {
    const result = feedbackApi.recordExecutionOutcome({
      session_id: "sess_3",
      trace_id: "trace_3",
      route_id: "route_3",
      transport: "telegram",
      outcome: "failure",
      reason_code: "TOOL_FAILURE",
    });
    assert.ok(result.recorded);
  });

  await test("failure event visible in session summary", () => {
    feedbackApi.recordExecutionOutcome({ session_id: "sess_4", outcome: "failure", reason_code: "TIMEOUT" });
    const summary = feedbackApi.getSessionFeedbackSummary("sess_4");
    assert.equal(summary.failure_count, 1);
    assert.equal(summary.severity_breakdown.high, 0); // default severity not set
  });

  console.log("\nIntegration: Feedback Record Recovery Path:");

  await test("recovery success via fallback recorded", () => {
    const result = feedbackApi.recordRecoveryOutcome({
      session_id: "sess_5",
      trace_id: "trace_5",
      transport: "telegram",
      route_id: "route_5",
      recovery_type: "fallback",
      succeeded: true,
    });
    assert.ok(result.recorded);
  });

  await test("recovery failure via replay recorded", () => {
    const result = feedbackApi.recordRecoveryOutcome({
      session_id: "sess_6",
      trace_id: "trace_6",
      transport: "web",
      route_id: "route_6",
      recovery_type: "replay",
      succeeded: false,
      reason_code: "REPLAY_FAILED",
    });
    assert.ok(result.recorded);
  });

  await test("recovery events visible in route summary", () => {
    feedbackApi.recordRecoveryOutcome({ session_id: "sess_7", route_id: "route_7", recovery_type: "fallback", succeeded: true });
    feedbackApi.recordRecoveryOutcome({ session_id: "sess_8", route_id: "route_7", recovery_type: "replay", succeeded: false });
    const summary = feedbackApi.getRouteFeedbackSummary("route_7");
    assert.ok(summary.fallback_count >= 1);
    assert.ok(summary.recovered_count >= 1);
  });

  console.log("\nIntegration: Feedback Session Summary:");

  await test("session summary aggregates success/failure/recovered correctly", () => {
    feedbackApi.recordExecutionOutcome({ session_id: "sess_9", outcome: "success" });
    feedbackApi.recordExecutionOutcome({ session_id: "sess_9", outcome: "failure" });
    feedbackApi.recordRecoveryOutcome({ session_id: "sess_9", recovery_type: "fallback", succeeded: true });
    const summary = feedbackApi.getSessionFeedbackSummary("sess_9");
    assert.equal(summary.success_count, 1);
    assert.equal(summary.failure_count, 1);
    assert.ok(summary.recovered_count >= 1);
    assert.ok(summary.fallback_count >= 1);
  });

  console.log("\nIntegration: Feedback Route Summary:");

  await test("route summary aggregates failures/fallbacks/recoveries correctly", () => {
    feedbackApi.recordExecutionOutcome({ session_id: "sess_10", route_id: "route_10", outcome: "success" });
    feedbackApi.recordExecutionOutcome({ session_id: "sess_11", route_id: "route_10", outcome: "failure" });
    feedbackApi.recordRecoveryOutcome({ session_id: "sess_12", route_id: "route_10", recovery_type: "fallback", succeeded: true });
    feedbackApi.recordFeedbackEvent({ session_id: "sess_13", route_id: "route_10", event_type: "transport_degraded" });
    const summary = feedbackApi.getRouteFeedbackSummary("route_10");
    assert.equal(summary.success_count, 1);
    assert.equal(summary.failure_count, 1);
    assert.ok(summary.fallback_count >= 1);
    assert.equal(summary.degradation_count, 1);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
