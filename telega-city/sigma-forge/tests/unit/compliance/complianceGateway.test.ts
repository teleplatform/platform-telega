import assert from "node:assert/strict";
import { runComplianceGateway } from "../../../packages/runtime-safety-core/src/compliance/complianceGateway.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nCompliance Gateway:");

test("safe text passes compliance", () => {
  const result = runComplianceGateway("Hello world", { target: "provider" });
  assert.equal(result.decision.sensitivity, "public_safe");
  assert.equal(result.decision.allowed, true);
});

test("email triggers redaction for provider", () => {
  const result = runComplianceGateway("Contact user@example.com", { target: "provider" });
  assert.ok(result.decision.redactions.length > 0);
  assert.ok(result.decision.sensitivity === "confidential" || result.decision.sensitivity === "provider_restricted");
});

test("token triggers regulated for provider", () => {
  const result = runComplianceGateway("API key: sk-abc123def456ghi789jkl", { target: "provider" });
  assert.equal(result.decision.sensitivity, "regulated");
  assert.equal(result.decision.allowed, false);
});

test("sanitized payload is returned", () => {
  const result = runComplianceGateway({ email: "test@example.com", name: "John" }, { target: "provider" });
  assert.ok(result.sanitized_payload);
  assert.notEqual((result.sanitized_payload as any).email, "test@example.com");
});

test("audit entry is created", () => {
  const result = runComplianceGateway("Hello world", { target: "provider", tele_user_id: "u1", task_id: "t1" });
  assert.ok(result.audit.audit_id);
  assert.equal(result.audit.tele_user_id, "u1");
  assert.equal(result.audit.task_id, "t1");
});

test("outbound policy for public_safe allows external", () => {
  const result = runComplianceGateway("safe text", { target: "provider" });
  assert.equal(result.decision.outbound_policy.allow_external_model, true);
});

test("outbound policy for regulated blocks external", () => {
  const result = runComplianceGateway("sk-abc123def456ghi789jkl", { target: "provider" });
  assert.equal(result.decision.outbound_policy.allow_external_model, false);
  assert.equal(result.decision.outbound_policy.allow_local_only, true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
