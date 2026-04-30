// AuthZ Actor Tests — run with: npx tsx tests/unit/authz/actor.test.ts

import assert from "node:assert/strict";
import {
  parseSubject,
  subjectToRole,
  resolveActor,
  createSystemActor,
  createInternalActor,
  isSystemActor,
  isInternalActor,
  isMakerActor,
} from "../../../src/core/authz/actor.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log("\nparseSubject:");

test("parses telegram subject", () => {
  const result = parseSubject("tg:123456");
  assert.deepEqual(result, { kind: "telegram", rawId: "123456" });
});

test("parses api subject", () => {
  const result = parseSubject("api:key_abc123");
  assert.deepEqual(result, { kind: "api", rawId: "key_abc123" });
});

test("parses user subject", () => {
  const result = parseSubject("user:uuid-1234");
  assert.deepEqual(result, { kind: "user", rawId: "uuid-1234" });
});

test("parses maker subject", () => {
  const result = parseSubject("maker:maker-uuid");
  assert.deepEqual(result, { kind: "maker", rawId: "maker-uuid" });
});

test("parses system subject", () => {
  const result = parseSubject("system:runtime");
  assert.deepEqual(result, { kind: "system", rawId: "runtime" });
});

test("parses internal subject", () => {
  const result = parseSubject("internal:runtime");
  assert.deepEqual(result, { kind: "internal", rawId: "runtime" });
});

test("returns null for empty subject", () => {
  assert.equal(parseSubject(""), null);
});

test("returns null for invalid subject (no colon)", () => {
  assert.equal(parseSubject("invalid"), null);
});

test("returns null for unknown kind", () => {
  assert.equal(parseSubject("unknown:id"), null);
});

console.log("\nsubjectToRole:");

test("maps system to system role", () => {
  assert.equal(subjectToRole("system"), "system");
});

test("maps internal to internal role", () => {
  assert.equal(subjectToRole("internal"), "internal");
});

test("maps maker to creator role", () => {
  assert.equal(subjectToRole("maker"), "creator");
});

test("maps telegram to public role", () => {
  assert.equal(subjectToRole("telegram"), "public");
});

test("maps api to public role", () => {
  assert.equal(subjectToRole("api"), "public");
});

test("maps user to public role", () => {
  assert.equal(subjectToRole("user"), "public");
});

console.log("\nresolveActor:");

test("resolves telegram actor", () => {
  const actor = resolveActor("tg:123456");
  assert.ok(actor);
  assert.equal(actor!.id, "tg:123456");
  assert.equal(actor!.kind, "telegram");
  assert.equal(actor!.role, "public");
  assert.equal(actor!.isMaker, false);
  assert.equal(actor!.isSystem, false);
  assert.equal(actor!.isInternal, false);
});

test("resolves maker actor as creator role", () => {
  const actor = resolveActor("maker:maker-uuid");
  assert.ok(actor);
  assert.equal(actor!.role, "creator");
  assert.equal(actor!.isMaker, true);
});

test("resolves system actor", () => {
  const actor = resolveActor("system:runtime");
  assert.ok(actor);
  assert.equal(actor!.role, "system");
  assert.equal(actor!.isSystem, true);
});

test("returns null for invalid subject", () => {
  assert.equal(resolveActor("invalid"), null);
});

console.log("\ncreateSystemActor:");

test("creates system actor with correct properties", () => {
  const actor = createSystemActor();
  assert.equal(actor.id, "actor:system");
  assert.equal(actor.kind, "system");
  assert.equal(actor.role, "system");
  assert.equal(actor.isSystem, true);
  assert.equal(actor.isInternal, true);
  assert.equal(actor.isMaker, false);
});

console.log("\ncreateInternalActor:");

test("creates internal actor with correct properties", () => {
  const actor = createInternalActor();
  assert.equal(actor.id, "actor:internal");
  assert.equal(actor.kind, "internal");
  assert.equal(actor.role, "internal");
  assert.equal(actor.isSystem, false);
  assert.equal(actor.isInternal, true);
  assert.equal(actor.isMaker, false);
});

console.log("\nactor type guards:");

test("isSystemActor returns true for system actor", () => {
  assert.equal(isSystemActor(createSystemActor()), true);
});

test("isInternalActor returns true for internal actor", () => {
  assert.equal(isInternalActor(createInternalActor()), true);
});

test("isMakerActor returns true for maker actor", () => {
  const maker = resolveActor("maker:test");
  assert.ok(maker);
  assert.equal(isMakerActor(maker!), true);
});

test("isSystemActor returns false for public actor", () => {
  const user = resolveActor("tg:123");
  assert.ok(user);
  assert.equal(isSystemActor(user!), false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
