import assert from "node:assert/strict";
import { detectSensitiveText, detectSensitiveFields, detectSensitive } from "../../../packages/runtime-safety-core/src/compliance/detectSensitive.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nDetect Sensitive:");

test("detects email in text", () => {
  const result = detectSensitiveText("Contact user@example.com for info");
  assert.ok(result.length > 0);
  assert.ok(result.some((r) => r.kind === "pii" && r.field === "email"));
});

test("detects phone in text", () => {
  const result = detectSensitiveText("Call +1234567890 for support");
  assert.ok(result.length > 0);
  assert.ok(result.some((r) => r.kind === "pii" && r.field === "phone"));
});

test("detects token/secret in text", () => {
  const result = detectSensitiveText("API key: sk-abc123def456ghi789");
  assert.ok(result.length > 0);
  assert.ok(result.some((r) => r.kind === "secret"));
});

test("detects sensitive fields in object", () => {
  const result = detectSensitiveFields({ email: "test@example.com", phone: "+1234567890" });
  assert.ok(result.length >= 2);
});

test("detectSensitive handles string input", () => {
  const result = detectSensitive("user@example.com");
  assert.ok(result.length > 0);
});

test("detectSensitive handles object input", () => {
  const result = detectSensitive({ api_key: "sk-secret123" });
  assert.ok(result.length > 0);
});

test("returns empty for safe text", () => {
  const result = detectSensitiveText("Hello world, this is safe text");
  assert.equal(result.length, 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
