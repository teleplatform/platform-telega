// PD-W2/A5 — Live E2E: one isolated authenticated end-to-end execution through
// the full canonical facade (runDemoReply). Uses real intent classification,
// real Provider OS selection (local:llm), the real DemoReplyExecutor and a real
// file-backed evidence store. No destructive effect, no network.
// Run with: npx tsx tests/unit/dispatch-vnext/dispatch-vnext-e2e.test.ts

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import {
  initExecutionEvidenceStore,
  readEvidenceRecords,
} from "../../../src/runtime/evidence/execution-evidence-store.js";
import { runDemoReply } from "../../../src/runtime/dispatch-vnext/runtime.js";

async function main() {
  const evidenceDir = path.join(os.tmpdir(), "a5-dispatch-vnext-e2e-evidence");
  initExecutionEvidenceStore(evidenceDir);

  const executionId = `e2e_${Date.now()}`;
  const result = await runDemoReply({
    subject: "maker:e2e-user",
    authz: {
      action: "agent.run",
      resource_kind: "session",
      resource_id: executionId,
      is_owner: true,
      visibility_scope: "public",
    },
    message: "what is the runtime currently doing?",
    run_id: executionId,
    trace_id: executionId,
  });

  console.log("\n[dispatch-vnext-e2e] authenticated execution result:");
  console.log(JSON.stringify(result, null, 2));

  assert.equal(result.execution_state, "completed");
  assert.equal(result.outcome?.provider_result_ref, "local:llm");
  assert.ok(typeof result.outcome?.output === "string" && result.outcome.output.length > 0);

  const evidence = readEvidenceRecords({ trace_id: executionId, order: "asc" });
  console.log(`\n[dispatch-vnext-e2e] real evidence records for trace ${executionId}: ${evidence.length}`);
  for (const record of evidence) {
    console.log(
      `  ${record.type}  lifecycle=${record.lifecycle_state ?? "n/a"}  run_id=${record.run_id ?? ""}  job=${record.job_id}`,
    );
  }

  assert.ok(evidence.some((r) => r.type === "intent_classified"));
  assert.ok(evidence.some((r) => r.type === "provider_decision_created"));
  assert.ok(evidence.some((r) => r.type === "dispatch_started"));
  assert.ok(evidence.some((r) => r.type === "execution_started"));
  assert.ok(evidence.some((r) => r.type === "execution_finished" && r.lifecycle_state === "completed"));

  console.log("\n[dispatch-vnext-e2e] E2E PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error("[dispatch-vnext-e2e] E2E FAIL", e);
  process.exit(1);
});