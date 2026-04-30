import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { checkRuntimeCompliance } from "../../packages/runtime-safety-core/src/api/checkCompliance.js";
import { resolveRuntimeIdentity } from "../../packages/runtime-safety-core/src/identity/identityResolver.js";
import { resolveRuntimePolicy } from "../../packages/runtime-safety-core/src/api/resolvePolicy.js";
import { createIdentitiesRepo, createPoliciesRepo, createScopeBindingsRepo } from "../../packages/runtime-safety-core/src/storage/sqlite/identitiesRepo.js";
import { createComplianceAuditRepo } from "../../packages/runtime-safety-core/src/storage/sqlite/complianceAuditRepo.js";

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
  console.log("\nIntegration: R1 Compliance Flow:");

  const db = new Database(":memory:");
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-safety-core/src/storage/sqlite/schema.sql");
  db.exec(readFileSync(schemaPath, "utf-8"));

  await test("safe payload passes compliance and audit is saved", () => {
    const result = checkRuntimeCompliance("Hello world", { target: "provider", tele_user_id: "u1", task_id: "t1" }, db);
    assert.equal(result.decision.allowed, true);
    const auditRepo = createComplianceAuditRepo(db);
    const audits = auditRepo.getAuditsByTask("t1");
    assert.ok(audits.length > 0);
  });

  await test("sensitive payload is blocked and audited", () => {
    const result = checkRuntimeCompliance("sk-abc123def456ghi789jkl", { target: "provider", tele_user_id: "u1", task_id: "t2" }, db);
    assert.equal(result.decision.allowed, false);
    assert.equal(result.decision.sensitivity, "regulated");
  });

  console.log("\nIntegration: R1 Identity Flow:");

  await test("identity resolved and saved", () => {
    const result = resolveRuntimeIdentity({ tele_user_id: "user_1", session_id: "sess_1" });
    const identitiesRepo = createIdentitiesRepo(db);
    identitiesRepo.saveIdentity(result.identity);
    const saved = identitiesRepo.getIdentity("user_1");
    assert.ok(saved);
    assert.equal(saved!.tele_user_id, "user_1");
  });

  await test("policy saved and retrieved", () => {
    const policiesRepo = createPoliciesRepo(db);
    policiesRepo.savePolicy({
      agent_id: "agent_r1",
      allowed_tools: ["fs.read"],
      denied_tools: ["terminal.exec"],
      allowed_memory_scopes: ["run:agent_r1"],
      write_requires_approval: true,
      external_send_requires_sanitization: true,
      max_parallel_jobs: 3,
    });
    const policy = policiesRepo.getPolicy("agent_r1");
    assert.ok(policy);
    assert.equal(policy!.agent_id, "agent_r1");
  });

  await test("policy engine resolves with DB policy", () => {
    const decision = resolveRuntimePolicy({ agent_id: "agent_r1", tool_id: "fs.read" }, db);
    assert.equal(decision.allowed, true);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
