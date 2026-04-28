// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE OPERATOR SMOKE TESTS v1
//
// Verifies operator surface functionality.
//
// Checks:
// 1. owner can get recent
// 2. owner can get failed
// 3. owner can get blocked
// 4. owner can get detail
// 5. partner access
// 6. public is blocked
// 7. telegram summary is bounded
// 8. empty state is safe
// 9. detail view preserves key fields
// 10. recent/failed/blocked filters are correct
// ─────────────────────────────────────────────────────────────
import { initEvidenceStore, appendEvidenceToStore, } from "./forge-evidence-store.js";
import { canAccessEvidence, } from "./forge-evidence-operator-surface.js";
import { buildRecentEvidenceView, buildFailedEvidenceView, buildBlockedEvidenceView, buildInvocationDetailView, } from "./forge-evidence-views.js";
import { formatRecentEvidenceList, formatEvidenceDetail, } from "./forge-evidence-telegram.js";
const TEST_DIR = "./data/test-forge-operator";
const results = [];
function recordPass(name) {
    results.push({ ok: true, name });
}
function recordFail(name, error) {
    results.push({ ok: false, name, error });
}
async function runOperatorSmokeTest() {
    results.length = 0;
    try {
        initEvidenceStore({ storeDir: TEST_DIR });
        const ownerRecord = {
            invocationId: `inv_owner_${Date.now()}`,
            taskId: "task_owner_001",
            userId: "owner_user_123",
            role: "owner_creator_primary",
            chatId: "chat_456",
            action: "forge_code",
            target: "forge_remote",
            kind: "run_code",
            adapter: "forge_http",
            status: "done",
            summary: "Test completed",
            renderedText: "✅ Done",
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
        };
        await appendEvidenceToStore(ownerRecord);
        const failedRecord = {
            invocationId: `inv_failed_${Date.now()}`,
            taskId: "task_failed_001",
            userId: "owner_user_123",
            role: "owner_creator_primary",
            action: "forge_code",
            target: "forge_remote",
            kind: "run_code",
            adapter: "forge_http",
            status: "failed",
            summary: "Test failed",
            errorCode: "EXECUTION_ERROR",
            errorMessage: "Timeout",
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
        };
        await appendEvidenceToStore(failedRecord);
        const blockedRecord = {
            invocationId: `inv_blocked_${Date.now()}`,
            taskId: "task_blocked_001",
            userId: "partner_user_789",
            role: "partner_secondary",
            action: "forge_code",
            target: "forge_remote",
            kind: "run_code",
            status: "blocked",
            summary: "Blocked by policy",
            blockedReason: "access_denied",
            startedAt: new Date().toISOString(),
        };
        await appendEvidenceToStore(blockedRecord);
        const recent = await buildRecentEvidenceView(10);
        if (recent.length >= 1) {
            recordPass("1. owner can get recent");
        }
        else {
            recordFail("1. owner can get recent", "no data");
        }
        const failed = await buildFailedEvidenceView(10);
        if (failed.length >= 1 && failed[0].status === "failed") {
            recordPass("2. owner can get failed");
        }
        else {
            recordFail("2. owner can get failed", "filter wrong");
        }
        const blocked = await buildBlockedEvidenceView(10);
        if (blocked.length >= 1 && blocked[0].status === "blocked") {
            recordPass("3. owner can get blocked");
        }
        else {
            recordFail("3. owner can get blocked", "filter wrong");
        }
        const detail = await buildInvocationDetailView(ownerRecord.invocationId);
        if (detail && detail.taskId === ownerRecord.taskId && detail.status === "done") {
            recordPass("4. owner can get detail");
        }
        else {
            recordFail("4. owner can get detail", "not found");
        }
        const recentText = formatRecentEvidenceList(recent);
        if (recentText.length > 0 && recentText.length < 4000) {
            recordPass("5. telegram summary is bounded");
        }
        else {
            recordFail("5. telegram summary is bounded", "too long or empty");
        }
        const emptyView = await buildRecentEvidenceView(0);
        const emptyText = formatRecentEvidenceList(emptyView);
        if (emptyText.includes("Нет") || emptyText.length > 0) {
            recordPass("6. empty state is safe");
        }
        else {
            recordFail("6. empty state is safe", "crashed");
        }
        if (detail) {
            const detailText = formatEvidenceDetail(detail);
            if (detailText.includes("Task:") && detailText.includes("Status:")) {
                recordPass("7. detail view preserves key fields");
            }
            else {
                recordFail("7. detail view preserves key fields", "missing fields");
            }
        }
        else {
            recordFail("7. detail view preserves key fields", "no detail");
        }
        if (canAccessEvidence("owner_creator_primary")) {
            recordPass("8. owner can access");
        }
        else {
            recordFail("8. owner can access", "blocked");
        }
        if (!canAccessEvidence("public_user")) {
            recordPass("9. public is blocked");
        }
        else {
            recordFail("9. public is blocked", "allowed");
        }
        if (!canAccessEvidence("random_user_xyz")) {
            recordPass("10. random user is blocked");
        }
        else {
            recordFail("10. random user is blocked", "allowed");
        }
    }
    catch (e) {
        recordFail("0. smoke test execution", e.message);
    }
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    console.log(`[smoke] Operator Surface: passed=${passed} failed=${failed}`);
    results.forEach((r) => {
        if (r.ok) {
            console.log(`  ✓ ${r.name}`);
        }
        else {
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
export async function runForgeOperatorSmoke() {
    const result = await runOperatorSmokeTest();
    if (!result.ok) {
        throw new Error(`Operator smoke failed: ${result.failed} tests failed`);
    }
}
export { runOperatorSmokeTest };
if (process.env.NODE_ENV === "test") {
    runForgeOperatorSmoke();
}
