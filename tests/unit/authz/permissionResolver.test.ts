// AuthZ Permission Resolver V2 Tests — Pack 2 — run with: npx tsx tests/unit/authz/permissionResolver.test.ts

import assert from "node:assert/strict";
import { permissionResolverV2 } from "../../../src/core/authz/permissionResolver.js";
import type { PermissionContext } from "../../../src/types/authz.js";

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

console.log("\nScenario 1 — Public user runs agent:");

test("public user can run agent on own session", () => {
  const ctx: PermissionContext = {
    actor_id: "tg:123",
    actor_mode: "public",
    role: "public",
    action: "agent.run",
    resource_kind: "session",
    resource_id: "sid_test",
    is_owner: true,
    visibility_scope: "private",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "allow");
});

test("public user CANNOT stream (missing capability)", () => {
  const ctx: PermissionContext = {
    actor_id: "tg:123",
    actor_mode: "public",
    role: "public",
    action: "agent.stream",
    resource_kind: "session",
    resource_id: "sid_test",
    is_owner: true,
    visibility_scope: "private",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "deny");
  assert.equal(result.explain.reason_code, "MISSING_CAPABILITY");
});

console.log("\nScenario 2 — Creator:");

test("creator can stream own session", () => {
  const ctx: PermissionContext = {
    actor_id: "maker:creator1",
    actor_mode: "creator",
    role: "creator",
    action: "agent.stream",
    resource_kind: "session",
    resource_id: "sid_test",
    is_owner: true,
    visibility_scope: "private",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "allow");
});

test("creator CANNOT stream other's session (not owner)", () => {
  const ctx: PermissionContext = {
    actor_id: "maker:creator1",
    actor_mode: "creator",
    role: "creator",
    action: "agent.stream",
    resource_kind: "session",
    resource_id: "sid_other",
    is_owner: false,
    visibility_scope: "private",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "deny");
  assert.equal(result.explain.reason_code, "NOT_OWNER");
});

test("creator can verify own evidence", () => {
  const ctx: PermissionContext = {
    actor_id: "maker:creator1",
    actor_mode: "creator",
    role: "creator",
    action: "evidence.verify",
    resource_kind: "evidence",
    resource_id: "sid_test",
    is_owner: true,
    visibility_scope: "private",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "allow");
});

console.log("\nScenario 3 — System override:");

test("system can stream any session (even not owner)", () => {
  const ctx: PermissionContext = {
    actor_id: "actor:system",
    actor_mode: "system",
    role: "system",
    action: "agent.stream",
    resource_kind: "session",
    resource_id: "sid_other",
    is_owner: false,
    visibility_scope: "private",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "allow");
  assert.equal(result.explain.reason_code, "SYSTEM_OVERRIDE");
});

console.log("\nScenario 4 — Provider access:");

test("public user denied for openai provider", () => {
  const ctx: PermissionContext = {
    actor_id: "tg:123",
    actor_mode: "public",
    role: "public",
    action: "agent.run",
    resource_kind: "session",
    resource_id: "sid_test",
    is_owner: true,
    visibility_scope: "private",
    provider_id: "openai",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "deny");
  assert.equal(result.explain.reason_code, "PROVIDER_DENIED");
});

test("creator allowed for openai provider", () => {
  const ctx: PermissionContext = {
    actor_id: "maker:creator1",
    actor_mode: "creator",
    role: "creator",
    action: "agent.run",
    resource_kind: "session",
    resource_id: "sid_test",
    is_owner: true,
    visibility_scope: "private",
    provider_id: "openai",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "allow");
});

console.log("\nScenario 5 — Tool access:");

test("creator denied for terminal.exec tool", () => {
  const ctx: PermissionContext = {
    actor_id: "maker:creator1",
    actor_mode: "creator",
    role: "creator",
    action: "agent.run",
    resource_kind: "session",
    resource_id: "sid_test",
    is_owner: true,
    visibility_scope: "private",
    tool_id: "terminal.exec",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "deny");
  assert.equal(result.explain.reason_code, "TOOL_DENIED");
});

test("internal allowed for terminal.exec tool", () => {
  const ctx: PermissionContext = {
    actor_id: "internal:ops1",
    actor_mode: "internal",
    role: "internal",
    action: "agent.run",
    resource_kind: "session",
    resource_id: "sid_test",
    is_owner: true,
    visibility_scope: "private",
    tool_id: "terminal.exec",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.equal(result.decision, "allow");
});

console.log("\nScenario 6 — Explain payload:");

test("deny explain includes reason_code", () => {
  const ctx: PermissionContext = {
    actor_id: "tg:123",
    actor_mode: "public",
    role: "public",
    action: "agent.stream",
    resource_kind: "session",
    resource_id: "sid_test",
    is_owner: true,
    visibility_scope: "private",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.ok(result.explain.reason_code);
  assert.ok(result.explain.explain.length > 0);
  assert.equal(result.explain.actor_mode, "public");
  assert.equal(result.explain.effective_mode, "public");
});

test("allow explain includes granted_by", () => {
  const ctx: PermissionContext = {
    actor_id: "actor:system",
    actor_mode: "system",
    role: "system",
    action: "agent.stream",
    resource_kind: "session",
    resource_id: "sid_test",
    is_owner: false,
    visibility_scope: "private",
  };
  const result = permissionResolverV2.resolve(ctx);
  assert.ok(result.explain.granted_by);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
