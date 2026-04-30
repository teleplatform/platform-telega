// AuthZ Permission Resolver Tests — run with: npx tsx tests/unit/authz/permissions.test.ts

import assert from "node:assert/strict";
import { PermissionResolver, defaultPermissionResolver } from "../../../src/core/authz/permissions.js";
import { resolveActor, createSystemActor, createInternalActor } from "../../../src/core/authz/actor.js";

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

const publicActor = resolveActor("tg:123456")!;
const creatorActor = resolveActor("maker:test")!;
const systemActor = createSystemActor();
const internalActor = createInternalActor();

console.log("\nPermissionResolver — role capabilities:");

test("public role has run_agent capability", () => {
  const profile = defaultPermissionResolver.buildProfile(publicActor);
  assert.ok(defaultPermissionResolver.hasCapability(profile, "run_agent"));
});

test("public role does NOT have read_stream capability", () => {
  const profile = defaultPermissionResolver.buildProfile(publicActor);
  assert.equal(defaultPermissionResolver.hasCapability(profile, "read_stream"), false);
});

test("creator role has read_stream capability", () => {
  const profile = defaultPermissionResolver.buildProfile(creatorActor);
  assert.ok(defaultPermissionResolver.hasCapability(profile, "read_stream"));
});

test("creator role has write_workspace capability", () => {
  const profile = defaultPermissionResolver.buildProfile(creatorActor);
  assert.ok(defaultPermissionResolver.hasCapability(profile, "write_workspace"));
});

test("system role has all capabilities", () => {
  const profile = defaultPermissionResolver.buildProfile(systemActor);
  assert.ok(defaultPermissionResolver.hasCapability(profile, "run_agent"));
  assert.ok(defaultPermissionResolver.hasCapability(profile, "read_stream"));
  assert.ok(defaultPermissionResolver.hasCapability(profile, "verify_evidence"));
  assert.ok(defaultPermissionResolver.hasCapability(profile, "call_bridge_worker"));
});

console.log("\nPermissionResolver — provider access:");

test("public role can only use local provider", () => {
  const profile = defaultPermissionResolver.buildProfile(publicActor);
  assert.equal(defaultPermissionResolver.canAccessProvider(profile, "local"), true);
  assert.equal(defaultPermissionResolver.canAccessProvider(profile, "openai"), false);
});

test("creator role can use openai provider", () => {
  const profile = defaultPermissionResolver.buildProfile(creatorActor);
  assert.equal(defaultPermissionResolver.canAccessProvider(profile, "openai"), true);
});

test("system role can use any provider", () => {
  const profile = defaultPermissionResolver.buildProfile(systemActor);
  assert.equal(defaultPermissionResolver.canAccessProvider(profile, "any_provider"), true);
});

console.log("\nPermissionResolver — tool access:");

test("public role has no tool access", () => {
  const profile = defaultPermissionResolver.buildProfile(publicActor);
  assert.equal(defaultPermissionResolver.canInvokeTool(profile, "fs.read"), false);
});

test("creator role can use fs.read and net.fetch", () => {
  const profile = defaultPermissionResolver.buildProfile(creatorActor);
  assert.equal(defaultPermissionResolver.canInvokeTool(profile, "fs.read"), true);
  assert.equal(defaultPermissionResolver.canInvokeTool(profile, "net.fetch"), true);
});

console.log("\nPermissionResolver — checkPermission:");

test("public actor can run agent (not owner, but run doesn't require ownership)", () => {
  const result = defaultPermissionResolver.checkPermission(publicActor, "agent.run", false);
  assert.equal(result.decision, "allow");
});

test("public actor CANNOT stream (requires ownership)", () => {
  const result = defaultPermissionResolver.checkPermission(publicActor, "agent.stream", false);
  assert.equal(result.decision, "deny");
});

test("creator actor can stream if owner", () => {
  const result = defaultPermissionResolver.checkPermission(creatorActor, "agent.stream", true);
  assert.equal(result.decision, "allow");
});

test("creator actor CANNOT stream if not owner", () => {
  const result = defaultPermissionResolver.checkPermission(creatorActor, "agent.stream", false);
  assert.equal(result.decision, "deny");
});

test("system actor can always stream (system_override)", () => {
  const result = defaultPermissionResolver.checkPermission(systemActor, "agent.stream", false);
  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "system_override");
});

test("internal actor can always stream (internal_override)", () => {
  const result = defaultPermissionResolver.checkPermission(internalActor, "agent.stream", false);
  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "internal_override");
});

test("deny reason includes role_not_allowed for public on evidence.verify", () => {
  const result = defaultPermissionResolver.checkPermission(publicActor, "evidence.verify", false);
  assert.equal(result.decision, "deny");
  assert.ok(result.reason?.includes("role_not_allowed"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
