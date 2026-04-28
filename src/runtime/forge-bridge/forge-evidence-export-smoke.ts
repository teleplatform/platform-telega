// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE EXPORT SMOKE TESTS v1
//
// Verifies export layer functionality.
//
// Checks:
// 1. append evidence to store
// 2. retrieve by invocationId
// 3. retrieve by taskId  4. retrieve by userId
// 5. filter by status
// 6. timeline query works
// 7. export json works
// 8. export jsonl works
// 9. export summary works
// 10. empty result handled safely
// ─────────────────────────────────────────────────────────────

import type { ForgeInvocationStatus } from "./forge-invocation-evidence.types.js";
import {
  initEvidenceStore,
  appendEvidenceToStore,
  getEvidenceByInvocationId,
  getEvidenceByTaskId,
  listEvidenceFromStore,
  getEvidenceCount,
} from "./forge-evidence-store.js";
import {
  queryEvidence,
  listEvidenceByUser,
  listEvidenceByStatus,
  listEvidenceTimeline,
  getEvidenceStats,
} from "./forge-evidence-query.js";
import {
  exportEvidence,
  exportEvidenceByUser,
  exportRecentEvidence,
} from "./forge-evidence-export.js";

const TEST_OUTPUT_DIR = "./data/test-forge-evidence";

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

async function runExportSmokeTest(): Promise<{
  ok: boolean;
  passed: number;
  failed: number;
  results: SmokeResult[];
}> {
  results.length = 0;

  try {
    initEvidenceStore({ storeDir: TEST_OUTPUT_DIR });

    const testRecord = {
      invocationId: `inv_smoke_${Date.now()}`,
      taskId: `task_smoke_001`,
      userId: "test_user_export",
      role: "owner_runtime",
      action: "forge_code",
      target: "forge_remote",
      kind: "run_code",
      adapter: "forge_http",
      status: "started" as ForgeInvocationStatus,
      summary: "Smoke test invocation",
      startedAt: new Date().toISOString(),
    };

    await appendEvidenceToStore(testRecord);
    recordPass("1. append evidence to store");

    const byInvocation = await getEvidenceByInvocationId(testRecord.invocationId);
    if (byInvocation && byInvocation.taskId === testRecord.taskId) {
      recordPass("2. retrieve by invocationId");
    } else {
      recordFail("2. retrieve by invocationId", "not found");
    }

    const byTask = await getEvidenceByTaskId(testRecord.taskId);
    if (byTask && byTask.invocationId === testRecord.invocationId) {
      recordPass("3. retrieve by taskId");
    } else {
      recordFail("3. retrieve by taskId", "not found");
    }

    const byUser = await listEvidenceByUser("test_user_export", 10);
    if (byUser.length >= 1) {
      recordPass("4. retrieve by userId");
    } else {
      recordFail("4. retrieve by userId", "not found");
    }

    const byStatus = await listEvidenceByStatus("started", 10);
    if (byStatus.length >= 1) {
      recordPass("5. filter by status");
    } else {
      recordFail("5. filter by status", "not found");
    }

    const timeline = await listEvidenceTimeline({ limit: 5 });
    if (timeline.length >= 1) {
      recordPass("6. timeline query works");
    } else {
      recordFail("6. timeline query works", "empty");
    }

    const jsonExport = await exportEvidence({ limit: 1 }, "json");
    if (jsonExport.ok && jsonExport.count >= 1) {
      recordPass("7. export json works");
    } else {
      recordFail("7. export json works", jsonExport.error || "no data");
    }

    const jsonlExport = await exportEvidence({ limit: 1 }, "jsonl");
    if (jsonlExport.ok && jsonlExport.count >= 1) {
      recordPass("8. export jsonl works");
    } else {
      recordFail("8. export jsonl works", jsonlExport.error || "no data");
    }

    const summaryExport = await exportEvidence({ limit: 1 }, "summary");
    if (summaryExport.ok && summaryExport.count >= 1) {
      recordPass("9. export summary works");
    } else {
      recordFail("9. export summary works", summaryExport.error || "no data");
    }

    const emptyQuery = await listEvidenceFromStore({ userId: "nonexistent_user_xyz" });
    if (emptyQuery.length === 0) {
      recordPass("10. empty result handled safely");
    } else {
      recordFail("10. empty result handled safely", "expected empty");
    }

    const stats = await getEvidenceStats();
    if (stats.total >= 1) {
      recordPass("11. evidence stats works");
    } else {
      recordFail("11. evidence stats works", "stats unavailable");
    }

    const recent = await exportRecentEvidence(3, "summary");
    if (recent.ok && recent.count >= 1) {
      recordPass("12. export recent evidence works");
    } else {
      recordFail("12. export recent evidence works", recent.error || "no data");
    }
  } catch (e: any) {
    recordFail("0. smoke test execution", e.message);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log(`[smoke] Export Pack: passed=${passed} failed=${failed}`);
  results.forEach((r) => {
    if (r.ok) {
      console.log(`  ✓ ${r.name}`);
    } else {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    }
  });

  return {
    ok: failed === 0,
    passed,
    failed,
    results,
  };
}

export async function runForgeExportSmoke(): Promise<void> {
  const result = await runExportSmokeTest();
  if (!result.ok) {
    throw new Error(`Export smoke failed: ${result.failed} tests failed`);
  }
}

export { runExportSmokeTest };

if (process.env.NODE_ENV === "test") {
  runForgeExportSmoke();
}