import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHitlRepos } from "../../packages/runtime-hitl-core/src/storage/sqlite/hitlRepo.js";
import { createHitlApi } from "../../packages/runtime-hitl-core/src/api/hitlApi.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIntegration: R16-S3 HITL Protocol:");

const db = new Database(":memory:");
const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-hitl-core/src/storage/sqlite/schema.sql");
db.exec(readFileSync(schemaPath, "utf-8"));
const repos = createHitlRepos(db);
const api = createHitlApi({ repos });

// 1. Handoff Creation
test("create approval_required handoff", () => {
  const h = api.createHandoff({
    mission_id: "mission_1",
    handoff_type: "approval_required",
    reason_code: "HIGH_RISK_ACTION",
    summary: "High risk publish action",
    requested_decision: "approve",
    paused_stage: "execution",
  });
  assert.ok(h.handoff_id);
  assert.equal(h.status, "waiting");
  assert.equal(h.handoff_type, "approval_required");
});

test("create escalation_required handoff", () => {
  const h = api.createHandoff({
    mission_id: "mission_2",
    handoff_type: "escalation_required",
    reason_code: "POLICY_CONFLICT",
    summary: "Conflict between policy and utility",
    requested_decision: "choose_option",
    paused_stage: "triage",
    options_json: JSON.stringify(["proceed", "abort"]),
    recommended_option: "proceed",
  });
  assert.ok(h.handoff_id);
  assert.equal(h.requested_decision, "choose_option");
});

test("create ambiguity resolution handoff", () => {
  const h = api.createHandoff({
    mission_id: "mission_3",
    handoff_type: "ambiguity_resolution",
    reason_code: "INSUFFICIENT_CONTEXT",
    summary: "Need human input to resolve ambiguity",
    requested_decision: "provide_input",
    paused_stage: "planning",
  });
  assert.ok(h.handoff_id);
  assert.equal(h.requested_decision, "provide_input");
});

test("get open handoffs", () => {
  const open = api.getOpenHandoffs();
  assert.ok(open.length >= 3);
});

// 2. Decision Recording
test("record approve decision", () => {
  const h = api.createHandoff({
    mission_id: "mission_4",
    handoff_type: "approval_required",
    reason_code: "HIGH_RISK_ACTION",
    summary: "Needs approval",
    requested_decision: "approve",
    paused_stage: "execution",
  });
  const d = api.recordHumanDecision({
    handoff_id: h.handoff_id,
    mission_id: "mission_4",
    actor_id: "admin_1",
    decision: "approved",
    note: "Looks safe",
  });
  assert.equal(d.decision, "approved");
  assert.equal(d.actor_id, "admin_1");
});

test("record reject decision", () => {
  const h = api.createHandoff({
    mission_id: "mission_5",
    handoff_type: "approval_required",
    reason_code: "BUDGET_CONFIRMATION_REQUIRED",
    summary: "Budget confirmation",
    requested_decision: "approve",
    paused_stage: "execution",
  });
  const d = api.recordHumanDecision({
    handoff_id: h.handoff_id,
    mission_id: "mission_5",
    actor_id: "admin_2",
    decision: "rejected",
    note: "Budget too high",
  });
  assert.equal(d.decision, "rejected");
});

test("record option_selected decision", () => {
  const h = api.createHandoff({
    mission_id: "mission_6",
    handoff_type: "ambiguity_resolution",
    reason_code: "INSUFFICIENT_CONTEXT",
    summary: "Choose an option",
    requested_decision: "choose_option",
    paused_stage: "planning",
    options_json: JSON.stringify(["option_a", "option_b"]),
    recommended_option: "option_a",
  });
  const d = api.recordHumanDecision({
    handoff_id: h.handoff_id,
    mission_id: "mission_6",
    actor_id: "admin_3",
    decision: "option_selected",
    selected_option: "option_a",
  });
  assert.equal(d.selected_option, "option_a");
});

// 3. Resume
test("approved decision resumes correctly", () => {
  const h = api.createHandoff({
    mission_id: "mission_7",
    handoff_type: "approval_required",
    reason_code: "HIGH_RISK_ACTION",
    summary: "Needs approval",
    requested_decision: "approve",
    paused_stage: "execution",
  });
  api.recordHumanDecision({
    handoff_id: h.handoff_id,
    mission_id: "mission_7",
    actor_id: "admin_4",
    decision: "approved",
    note: "Looks fine",
  });
  const r = api.resumeFromDecision({ handoff_id: h.handoff_id, mission_id: "mission_7" });
  assert.equal(r.resume_mode, "continue_same_run");
  assert.equal(r.result_status, "resumed");
  assert.equal(r.resumed_by, "human_decision");
});

test("rejected decision cancels correctly", () => {
  const h = api.createHandoff({
    mission_id: "mission_8",
    handoff_type: "approval_required",
    reason_code: "BUDGET_CONFIRMATION_REQUIRED",
    summary: "Budget check",
    requested_decision: "approve",
    paused_stage: "execution",
  });
  api.recordHumanDecision({
    handoff_id: h.handoff_id,
    mission_id: "mission_8",
    actor_id: "admin_5",
    decision: "rejected",
    note: "Budget too high",
  });
  const r = api.resumeFromDecision({ handoff_id: h.handoff_id, mission_id: "mission_8" });
  assert.equal(r.resume_mode, "cancel_after_rejection");
  assert.equal(r.result_status, "cancelled");
});

// 4. Expiry
test("expired handoff cannot record decision", () => {
  const h = api.createHandoff({
    mission_id: "mission_9",
    handoff_type: "approval_required",
    reason_code: "HIGH_RISK_ACTION",
    summary: "Needs approval",
    requested_decision: "approve",
    paused_stage: "execution",
    decision_ttl_at: "2020-01-01T00:00:00Z",
  });
  api.expireHandoff(h.handoff_id, "TTL expired");
  const repos2 = createHitlRepos(db);
  const updated = repos2.handoffs.getById(h.handoff_id);
  assert.equal(updated!.status, "expired");
});

// 5. Audit Trail
test("audit trail tracks full lifecycle", () => {
  const h = api.createHandoff({
    mission_id: "mission_10",
    handoff_type: "escalation_required",
    reason_code: "CONSTITUTIONAL_AMBIGUITY",
    summary: "Constitutional ambiguity detected",
    requested_decision: "choose_option",
    paused_stage: "execution",
    options_json: JSON.stringify(["proceed_with_caution", "abort"]),
  });
  api.recordHumanDecision({
    handoff_id: h.handoff_id,
    mission_id: "mission_10",
    actor_id: "admin_6",
    decision: "option_selected",
    selected_option: "proceed_with_caution",
    note: "Proceed with caution",
  });
  api.resumeFromDecision({ handoff_id: h.handoff_id, mission_id: "mission_10" });

  const audit = api.getHandoffAuditTrail("mission_10");
  assert.ok(audit.some((e) => e.event_type === "handoff_created"));
  assert.ok(audit.some((e) => e.event_type === "decision_recorded"));
  assert.ok(audit.some((e) => e.event_type === "resume_completed"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
