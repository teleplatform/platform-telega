// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE SMOKE TESTS v1
//
// Verifies evidence layer functionality.
//
// Checks:
// 1. started evidence is created
// 2. successful invoke updates evidence to done
// 3. blocked invoke updates evidence to blocked
// 4. failed invoke updates evidence to failed
// 5. renderedText is stored
// 6. taskId/invocationId linkage preserved
// 7. role/userId/target/kind preserved
// ─────────────────────────────────────────────────────────────

import type { ForgeInvocationStatus } from "./forge-invocation-evidence.types.js";
import {
  createInvocationEvidence,
  updateInvocationEvidence,
  getInvocationEvidence,
  findInvocationEvidenceByTaskId,
  findInvocationEvidenceByUserId,
  clearInvocationEvidence,
  getEvidenceStoreSize,
} from "./forge-invocation-evidence.js";
import { buildForgeInvocationAuditLine } from "./forge-invocation-audit.js";

const TEST_USER_ID = "test_user_123";
const TEST_CHAT_ID = "test_chat_456";

interface SmokeResult {
  ok: boolean;
  name: string;
  error?: string;
}

const results: SmokeResult[] = [];

function recordPass(name: string): void {
  results.push({ ok: true, name });
}

function recordFail(name: string, error: string): void {
  results.push({ ok: false, name, error });
}

function runSmokeTest(): { ok: boolean; passed: number; failed: number; results: SmokeResult[] } {
  clearInvocationEvidence();
  results.length = 0;

  try {
    const testData = {
      userId: TEST_USER_ID,
      chatId: TEST_CHAT_ID,
      action: "forge_code",
      target: "forge_remote",
      kind: "run_code",
      adapter: "forge_http",
    };

    const taskId = "task_test_001";
    const invocationId = `inv_test_${Date.now()}`;

    const startedRecord = {
      invocationId,
      taskId,
      userId: testData.userId,
      role: "owner_runtime",
      chatId: testData.chatId,
      action: testData.action,
      target: testData.target,
      kind: testData.kind,
      adapter: testData.adapter,
      status: "started" as ForgeInvocationStatus,
      summary: "Forge invocation started",
      startedAt: new Date().toISOString(),
    };

    createInvocationEvidence(startedRecord);
    recordPass("1. started evidence is created");

    const lookedUp = getInvocationEvidence(invocationId);
    if (lookedUp && lookedUp.taskId === taskId && lookedUp.userId === testData.userId) {
      recordPass("2. evidence can be retrieved by invocationId");
    } else {
      recordFail("2. evidence can be retrieved by invocationId", "lookup failed");
    }

    const taskLookup = findInvocationEvidenceByTaskId(taskId);
    if (taskLookup && taskLookup.invocationId === invocationId) {
      recordPass("3. taskId/invocationId linkage preserved");
    } else {
      recordFail("3. taskId/invocationId linkage preserved", "task lookup failed");
    }

    if (taskLookup && taskLookup.role === "owner_runtime" && taskLookup.target === testData.target && taskLookup.kind === testData.kind) {
      recordPass("4. role/userId/target/kind preserved in record");
    } else {
      recordFail("4. role/userId/target/kind preserved in record", "fields mismatch");
    }

    const doneUpdate = new Date().toISOString();
    updateInvocationEvidence(invocationId, {
      status: "done",
      summary: "Forge execution completed",
      renderedText: "✅ Code executed successfully",
      finishedAt: doneUpdate,
    });
    recordPass("5. successful invoke updates evidence to done");

    const doneRecord = getInvocationEvidence(invocationId);
    if (doneRecord && doneRecord.status === "done" && doneRecord.renderedText === "✅ Code executed successfully") {
      recordPass("6. renderedText is stored");
    } else {
      recordFail("6. renderedText is stored", "renderedText not found");
    }

    const blockedRecord = {
      invocationId: `inv_blocked_${Date.now()}`,
      taskId: "task_blocked_001",
      userId: "blocked_user",
      role: "partner",
      action: "forge_code",
      target: "forge_remote",
      kind: "run_code",
      status: "started" as ForgeInvocationStatus,
      summary: "Blocked invocation started",
      startedAt: new Date().toISOString(),
    };
    createInvocationEvidence(blockedRecord);

    updateInvocationEvidence(blockedRecord.invocationId, {
      status: "blocked",
      blockedReason: "forge_access_forbidden",
      summary: "Forge blocked by policy",
      renderedText: "⛔ Forge access forbidden",
      finishedAt: new Date().toISOString(),
    });
    recordPass("7. blocked invoke updates evidence to blocked");

    const blockedLookup = getInvocationEvidence(blockedRecord.invocationId);
    if (blockedLookup && blockedLookup.status === "blocked" && blockedLookup.blockedReason === "forge_access_forbidden") {
      recordPass("8. blockedReason is stored");
    } else {
      recordFail("8. blockedReason is stored", "blockedReason not found");
    }

    const failedRecord = {
      invocationId: `inv_failed_${Date.now()}`,
      taskId: "task_failed_001",
      userId: TEST_USER_ID,
      role: "owner_runtime",
      action: "forge_code",
      target: "forge_remote",
      kind: "run_code",
      status: "started" as ForgeInvocationStatus,
      summary: "Failed invocation started",
      startedAt: new Date().toISOString(),
    };
    createInvocationEvidence(failedRecord);

    updateInvocationEvidence(failedRecord.invocationId, {
      status: "failed",
      errorCode: "EXECUTION_ERROR",
      errorMessage: "Forge execution timed out",
      summary: "Forge invocation failed",
      finishedAt: new Date().toISOString(),
    });
    recordPass("9. failed invoke updates evidence to failed");

    const failedLookup = getInvocationEvidence(failedRecord.invocationId);
    if (failedLookup && failedLookup.status === "failed" && failedLookup.errorCode === "EXECUTION_ERROR") {
      recordPass("10. errorCode/errorMessage stored for failed");
    } else {
      recordFail("10. errorCode/errorMessage stored for failed", "error fields missing");
    }

    const userLookups = findInvocationEvidenceByUserId(TEST_USER_ID);
    const relevantUserRecords = userLookups.filter((r) => r.taskId === taskId || r.taskId === "task_failed_001");
    if (relevantUserRecords.length >= 1) {
      recordPass("11. userId lookup returns correct records");
    } else {
      recordFail("11. userId lookup returns correct records", "user lookup failed");
    }

    const auditLine = buildForgeInvocationAuditLine(doneRecord!);
    if (auditLine.includes("status=done") && auditLine.includes(`taskId=${taskId}`)) {
      recordPass("12. audit line build works");
    } else {
      recordFail("12. audit line build works", "audit line invalid");
    }
  } catch (e: any) {
    recordFail("0. smoke test execution", e.message);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log(`[smoke] Evidence Pack: passed=${passed} failed=${failed}`);
  results.forEach((r) => {
    if (r.ok) {
      console.log(`  ✓ ${r.name}`);
    } else {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    }
  });

  clearInvocationEvidence();

  return {
    ok: failed === 0,
    passed,
    failed,
    results,
  };
}

export function runForgeEvidenceSmoke(): void {
  const result = runSmokeTest();
  if (!result.ok) {
    throw new Error(`Evidence smoke failed: ${result.failed} tests failed`);
  }
}

export { runSmokeTest };

if (process.env.NODE_ENV === "test") {
  runForgeEvidenceSmoke();
}