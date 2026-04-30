import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createDepartmentRepos } from "../../packages/runtime-department-core/src/storage/sqlite/departmentRepo.js";
import { createDepartmentApi } from "../../packages/runtime-department-core/src/api/departmentApi.js";

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
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-department-core/src/storage/sqlite/schema.sql");
  db.exec(readFileSync(schemaPath, "utf-8"));

  const repos = createDepartmentRepos(db);
  const api = createDepartmentApi({ repos });

  console.log("\nIntegration: Mission Requires Plan:");

  await test("mission cannot be completed without plan", () => {
    const dept = api.createDepartment({ name: "Marketing", domain: "marketing", profile_type: "marketing", roles: ["planner", "executor"], created_by: "system" });
    const missionResult = api.createMission({ department_id: dept.department_id, title: "Campaign Launch", objective: "Launch campaign", mission_type: "campaign_launch", constraints: [], success_criteria: ["campaign_live"], priority: 1, created_by: "system" });
    const completeResult = api.completeMission({ mission_id: missionResult.mission.mission_id, completed_by: "system" });
    assert.equal(completeResult.completed, false);
    assert.ok(completeResult.error?.includes("failed") || completeResult.error?.includes("tasks"));
  });

  console.log("\nIntegration: Task Requires Role:");

  await test("task without assigned role cannot be executed", () => {
    const dept = api.createDepartment({ name: "Marketing", domain: "marketing", profile_type: "marketing", roles: ["planner", "executor"], created_by: "system" });
    const missionResult = api.createMission({ department_id: dept.department_id, title: "Test Mission", objective: "Test", mission_type: "content_series", constraints: [], success_criteria: ["done"], priority: 1, created_by: "system" });
    const planResult = api.planMission({
      mission_id: missionResult.mission.mission_id,
      tasks: [{ task_id: "task_1", description: "Test task", task_type: "draft_offer", assigned_role: "", depends_on: [] }],
      planned_by: "system",
    });
    const execResult = api.executeTask({ task_id: "task_1", output: {}, evidence_refs: ["evidence_1"], executed_by: "executor_1" });
    assert.ok(execResult.error?.includes("no assigned role"));
  });

  console.log("\nIntegration: Task Requires Evidence:");

  await test("task result without evidence refs rejected", () => {
    const dept = api.createDepartment({ name: "Marketing", domain: "marketing", profile_type: "marketing", roles: ["planner", "executor"], created_by: "system" });
    const missionResult = api.createMission({ department_id: dept.department_id, title: "Test Mission", objective: "Test", mission_type: "content_series", constraints: [], success_criteria: ["done"], priority: 1, created_by: "system" });
    const planResult = api.planMission({
      mission_id: missionResult.mission.mission_id,
      tasks: [{ task_id: "task_2", description: "Test task", task_type: "draft_offer", assigned_role: "executor", depends_on: [] }],
      planned_by: "system",
    });
    const execResult = api.executeTask({ task_id: "task_2", output: {}, evidence_refs: [], executed_by: "executor_1" });
    assert.ok(execResult.error?.includes("requires evidence refs"));
  });

  console.log("\nIntegration: Validation Blocks Invalid Output:");

  await test("invalid task result blocks mission completion", () => {
    const dept = api.createDepartment({ name: "Marketing", domain: "marketing", profile_type: "marketing", roles: ["planner", "executor", "validator"], created_by: "system" });
    const missionResult = api.createMission({ department_id: dept.department_id, title: "Test Mission", objective: "Test", mission_type: "campaign_launch", constraints: [], success_criteria: ["campaign_live"], priority: 1, created_by: "system" });
    const planResult = api.planMission({
      mission_id: missionResult.mission.mission_id,
      tasks: [{ task_id: "task_3", description: "Test task", task_type: "draft_offer", assigned_role: "executor", depends_on: [] }],
      planned_by: "system",
    });
    api.executeTask({ task_id: "task_3", output: {}, evidence_refs: ["evidence_1"], executed_by: "executor_1" });
    api.validateTaskResult({ task_id: "task_3", valid: false, validation_notes: "Output invalid", validated_by: "validator_1" });
    const completeResult = api.completeMission({ mission_id: missionResult.mission.mission_id, completed_by: "system" });
    assert.equal(completeResult.completed, false);
    assert.ok(completeResult.error?.includes("failed"));
  });

  console.log("\nIntegration: Mission Fails on Invalid Task:");

  await test("failed task causes mission to fail", () => {
    const dept = api.createDepartment({ name: "Marketing", domain: "marketing", profile_type: "marketing", roles: ["planner", "executor", "validator"], created_by: "system" });
    const missionResult = api.createMission({ department_id: dept.department_id, title: "Test Mission", objective: "Test", mission_type: "campaign_launch", constraints: [], success_criteria: ["done"], priority: 1, created_by: "system" });
    const planResult = api.planMission({
      mission_id: missionResult.mission.mission_id,
      tasks: [{ task_id: "task_4", description: "Test task", task_type: "draft_offer", assigned_role: "executor", depends_on: [] }],
      planned_by: "system",
    });
    api.executeTask({ task_id: "task_4", output: {}, evidence_refs: ["evidence_1"], executed_by: "executor_1" });
    api.validateTaskResult({ task_id: "task_4", valid: false, validation_notes: "Invalid", validated_by: "validator_1" });
    const completeResult = api.completeMission({ mission_id: missionResult.mission.mission_id, completed_by: "system" });
    assert.equal(completeResult.completed, false);
  });

  console.log("\nIntegration: Rollback Restores Mission State:");

  await test("mission rollback changes status to rolled_back", () => {
    const dept = api.createDepartment({ name: "Marketing", domain: "marketing", profile_type: "marketing", roles: ["planner", "executor"], created_by: "system" });
    const missionResult = api.createMission({ department_id: dept.department_id, title: "Test Mission", objective: "Test", mission_type: "campaign_launch", constraints: [], success_criteria: ["done"], priority: 1, created_by: "system" });
    const rollbackResult = api.rollbackMission({ mission_id: missionResult.mission.mission_id, reason: "Strategic pivot", rolled_back_by: "system" });
    assert.equal(rollbackResult.rolled_back, true);
    const updated = repos.missions.getById(missionResult.mission.mission_id);
    assert.equal(updated!.status, "rolled_back");
  });

  console.log("\nIntegration: Audit Tracks Full Lifecycle:");

  await test("full mission lifecycle is audited", () => {
    const dept = api.createDepartment({ name: "Marketing", domain: "marketing", profile_type: "marketing", roles: ["planner", "executor", "validator"], created_by: "system" });
    const missionResult = api.createMission({ department_id: dept.department_id, title: "Audit Test", objective: "Test audit", mission_type: "weekly_report", constraints: [], success_criteria: ["report_done"], priority: 1, created_by: "system" });
    api.planMission({
      mission_id: missionResult.mission.mission_id,
      tasks: [{ task_id: "task_5", description: "Audit task", task_type: "prepare_digest", assigned_role: "executor", depends_on: [] }],
      planned_by: "system",
    });
    api.executeTask({ task_id: "task_5", output: { summary: "Done" }, evidence_refs: ["evidence_1"], executed_by: "executor_1" });
    api.validateTaskResult({ task_id: "task_5", valid: true, validated_by: "validator_1" });
    api.completeMission({ mission_id: missionResult.mission.mission_id, completed_by: "system" });

    const audit = api.getDepartmentAuditTrail(dept.department_id, missionResult.mission.mission_id);
    const eventTypes = audit.map((e) => e.event_type);
    assert.ok(eventTypes.includes("mission_created"));
    assert.ok(eventTypes.includes("mission_planned"));
    assert.ok(eventTypes.includes("task_executed"));
    assert.ok(eventTypes.includes("task_validated"));
    assert.ok(eventTypes.includes("mission_completed"));
  });

  console.log("\nIntegration: Marketing Mission Campaign Launch Flow:");

  await test("end-to-end marketing campaign launch flow works", () => {
    const dept = api.createDepartment({ name: "Tele•Ga Marketing", domain: "marketing", profile_type: "marketing", roles: ["planner", "campaign_strategist", "content_executor", "analyst", "validator", "reviewer"], created_by: "system" });

    const missionResult = api.createMission({
      department_id: dept.department_id,
      title: "Uzbekistan Seller Activation Campaign",
      objective: "Increase seller activation in Uzbekistan for 14 days",
      mission_type: "campaign_launch",
      constraints: ["budget_cap_100", "telegram_only"],
      success_criteria: ["10_new_sellers", "5_posts_published", "engagement_above_5pct"],
      priority: 1,
      created_by: "marketing_lead",
    });

    api.planMission({
      mission_id: missionResult.mission.mission_id,
      tasks: [
        { task_id: "task_collect", description: "Collect market signals", task_type: "collect_signals", assigned_role: "analyst", depends_on: [] },
        { task_id: "task_audience", description: "Define target audience", task_type: "define_audience", assigned_role: "campaign_strategist", depends_on: ["task_collect"] },
        { task_id: "task_offer", description: "Draft 3 offers", task_type: "draft_offer", assigned_role: "campaign_strategist", depends_on: ["task_audience"] },
        { task_id: "task_creative", description: "Generate 5 creatives", task_type: "generate_creative", assigned_role: "content_executor", depends_on: ["task_offer"] },
        { task_id: "task_review", description: "Review campaign", task_type: "review_campaign", assigned_role: "reviewer", depends_on: ["task_creative"] },
      ],
      planned_by: "planner_1",
    });

    api.executeTask({ task_id: "task_collect", output: { signals: ["signal_1", "signal_2"] }, evidence_refs: ["evidence_1"], executed_by: "analyst_1" });
    api.validateTaskResult({ task_id: "task_collect", valid: true, validated_by: "validator_1" });

    api.executeTask({ task_id: "task_audience", output: { audience: "sellers_uz" }, evidence_refs: ["evidence_2"], executed_by: "strategist_1" });
    api.validateTaskResult({ task_id: "task_audience", valid: true, validated_by: "validator_1" });

    api.executeTask({ task_id: "task_offer", output: { offers: ["offer_1", "offer_2", "offer_3"] }, evidence_refs: ["evidence_3"], executed_by: "strategist_1" });
    api.validateTaskResult({ task_id: "task_offer", valid: true, validated_by: "validator_1" });

    api.executeTask({ task_id: "task_creative", output: { creatives: ["creative_1", "creative_2", "creative_3", "creative_4", "creative_5"] }, evidence_refs: ["evidence_4"], executed_by: "executor_1" });
    api.validateTaskResult({ task_id: "task_creative", valid: true, validated_by: "validator_1" });

    api.executeTask({ task_id: "task_review", output: { approved: true }, evidence_refs: ["evidence_5"], executed_by: "reviewer_1" });
    api.validateTaskResult({ task_id: "task_review", valid: true, validated_by: "validator_1" });

    const completeResult = api.completeMission({ mission_id: missionResult.mission.mission_id, completed_by: "marketing_lead" });
    assert.equal(completeResult.completed, true);

    const audit = api.getDepartmentAuditTrail(dept.department_id, missionResult.mission.mission_id);
    assert.ok(audit.some((e) => e.event_type === "mission_completed"));
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
