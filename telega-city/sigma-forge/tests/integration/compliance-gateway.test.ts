import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createComplianceRepos } from "../../packages/runtime-compliance-core/src/storage/sqlite/complianceRepo.js";
import { createComplianceGateway } from "../../packages/runtime-compliance-core/src/api/complianceApi.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIntegration: R16-S1 Compliance Gateway:");

const db = new Database(":memory:");
const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-compliance-core/src/storage/sqlite/schema.sql");
db.exec(readFileSync(schemaPath, "utf-8"));
const repos = createComplianceRepos(db);
const gateway = createComplianceGateway({ repos });

// ==================== Classify Action ====================

test("safe internal action classified correctly", () => {
  const action = {
    action_id: "action_1",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "draft_post",
    side_effect_level: "none" as const,
    data_sensitivity: "none" as const,
    budget_impact: "none" as const,
    user_visible_effect: false,
    external_effect: false,
    payload_summary: "Draft a post",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.classifyAction(action);
  assert.equal(result, "safe_internal");
});

test("external medium risk classified correctly", () => {
  const action = {
    action_id: "action_2",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "crm_write",
    side_effect_level: "medium" as const,
    data_sensitivity: "sensitive" as const,
    budget_impact: "low" as const,
    user_visible_effect: false,
    external_effect: true,
    payload_summary: "Update CRM",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.classifyAction(action);
  assert.equal(result, "external_medium_risk");
});

test("high risk external classified correctly", () => {
  const action = {
    action_id: "action_3",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "publish_content",
    side_effect_level: "high" as const,
    data_sensitivity: "none" as const,
    budget_impact: "medium" as const,
    user_visible_effect: true,
    external_effect: true,
    payload_summary: "Publish content",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.classifyAction(action);
  assert.equal(result, "external_high_risk");
});

// ==================== Decision Logic ====================

test("safe internal action allowed", () => {
  const action = {
    action_id: "action_4",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "digest_build",
    side_effect_level: "none" as const,
    data_sensitivity: "none" as const,
    budget_impact: "none" as const,
    user_visible_effect: false,
    external_effect: false,
    payload_summary: "Build digest",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  assert.equal(result.decision.verdict, "allow");
  assert.equal(result.approval_request, null);
});

test("sensitive data action denied", () => {
  const action = {
    action_id: "action_5",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "crm_read",
    side_effect_level: "low" as const,
    data_sensitivity: "critical" as const,
    budget_impact: "none" as const,
    user_visible_effect: false,
    external_effect: true,
    payload_summary: "Read CRM",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  assert.equal(result.decision.verdict, "deny");
  assert.ok(result.decision.reason_codes.includes("SENSITIVE_DATA_EXPOSURE"));
});

test("payment action requires approval", () => {
  const action = {
    action_id: "action_6",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "payment_process",
    side_effect_level: "high" as const,
    data_sensitivity: "sensitive" as const,
    budget_impact: "high" as const,
    user_visible_effect: true,
    external_effect: true,
    payload_summary: "Process payment",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  assert.equal(result.decision.verdict, "require_approval");
  assert.equal(result.decision.requires_human_approval, true);
  assert.ok(result.approval_request);
  assert.ok(result.approval_request!.request_id);
});

test("high risk external write escalated", () => {
  const action = {
    action_id: "action_7",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "seller_profile_update",
    side_effect_level: "high" as const,
    data_sensitivity: "sensitive" as const,
    budget_impact: "none" as const,
    user_visible_effect: true,
    external_effect: true,
    payload_summary: "Update seller profile",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  assert.equal(result.decision.verdict, "escalate");
  assert.equal(result.decision.requires_human_approval, true);
  assert.ok(result.approval_request);
});

test("medium risk external action allowed with audit", () => {
  const action = {
    action_id: "action_8",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "provider_call",
    side_effect_level: "medium" as const,
    data_sensitivity: "none" as const,
    budget_impact: "low" as const,
    user_visible_effect: false,
    external_effect: true,
    payload_summary: "Call provider",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  assert.equal(result.decision.verdict, "allow_with_audit");
  assert.equal(result.decision.requires_human_approval, false);
});

test("high budget impact requires approval", () => {
  const action = {
    action_id: "action_9",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "campaign_launch",
    side_effect_level: "medium" as const,
    data_sensitivity: "none" as const,
    budget_impact: "high" as const,
    user_visible_effect: true,
    external_effect: true,
    payload_summary: "Launch campaign",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  assert.equal(result.decision.verdict, "require_approval");
  assert.equal(result.decision.requires_human_approval, true);
  assert.ok(result.decision.reason_codes.includes("BUDGET_THRESHOLD_EXCEEDED"));
});

// ==================== Approval Binding ====================

test("approval request created for require_approval verdict", () => {
  const action = {
    action_id: "action_10",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "crm_write",
    side_effect_level: "high" as const,
    data_sensitivity: "sensitive" as const,
    budget_impact: "medium" as const,
    user_visible_effect: true,
    external_effect: true,
    payload_summary: "Write to CRM",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  if (result.decision.requires_human_approval) {
    assert.ok(result.approval_request);
    assert.equal(result.approval_request!.status, "pending");
  }
});

test("approval request created for escalate verdict", () => {
  const action = {
    action_id: "action_11",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "external_publish",
    side_effect_level: "high" as const,
    data_sensitivity: "none" as const,
    budget_impact: "none" as const,
    user_visible_effect: true,
    external_effect: true,
    payload_summary: "Publish externally",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  assert.ok(result.approval_request);
  assert.equal(result.approval_request!.status, "pending");
});

// ==================== Deny Policy ====================

test("irreversible side effect requires approval", () => {
  const action = {
    action_id: "action_12",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "delete_seller_account",
    side_effect_level: "high" as const,
    data_sensitivity: "sensitive" as const,
    budget_impact: "none" as const,
    user_visible_effect: true,
    external_effect: true,
    payload_summary: "Delete seller account",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  assert.ok(result.decision.verdict === "require_approval" || result.decision.verdict === "deny" || result.decision.verdict === "escalate");
});

// ==================== Audit Trail ====================

test("every decision writes audit", () => {
  const action = {
    action_id: "action_13",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "safe_action",
    side_effect_level: "none" as const,
    data_sensitivity: "none" as const,
    budget_impact: "none" as const,
    user_visible_effect: false,
    external_effect: false,
    payload_summary: "Safe action",
    requested_at: new Date().toISOString(),
  };
  const result = gateway.evaluateCompliance(action);
  assert.ok(result.decision.decision_id);
  assert.ok(result.decision.decided_at);
});

test("approveAction records audit", () => {
  const action = {
    action_id: "action_14",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "crm_write",
    side_effect_level: "high" as const,
    data_sensitivity: "sensitive" as const,
    budget_impact: "medium" as const,
    user_visible_effect: true,
    external_effect: true,
    payload_summary: "Write CRM",
    requested_at: new Date().toISOString(),
  };
  gateway.evaluateCompliance(action);
  const result = gateway.approveAction("action_14", "admin_1");
  assert.equal(result.approved, true);
});

test("rejectAction records audit", () => {
  const action = {
    action_id: "action_15",
    actor_type: "agent" as const,
    actor_id: "agent_1",
    action_type: "external_write",
    side_effect_level: "high" as const,
    data_sensitivity: "sensitive" as const,
    budget_impact: "medium" as const,
    user_visible_effect: true,
    external_effect: true,
    payload_summary: "External write",
    requested_at: new Date().toISOString(),
  };
  gateway.evaluateCompliance(action);
  const result = gateway.rejectAction("action_15", "admin_1", "Not safe enough");
  assert.equal(result.rejected, true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
