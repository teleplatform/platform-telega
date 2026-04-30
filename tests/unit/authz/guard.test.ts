// AuthZ Guard Tests — run with: npx tsx tests/unit/authz/guard.test.ts

import assert from "node:assert/strict";
import {
  authzGuard,
  sessionGuard,
  evidenceGuard,
} from "../../../src/core/authz/guard.js";
import { resolveActor, createSystemActor, createInternalActor } from "../../../src/core/authz/actor.js";
import { ownershipRegistry } from "../../../src/core/authz/ownership.js";

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

const ownerActor = resolveActor("maker:owner123")!;
const otherUserActor = resolveActor("tg:789012")!;
const creatorActor = resolveActor("maker:test")!;
const systemActor = createSystemActor();
const internalActor = createInternalActor();

const testSid = "sid_test_001";
const testWorkspaceId = "ws_test_001";

// Register ownership for test session — owner is a creator
ownershipRegistry.registerOwnership({
  resource_kind: "session",
  resource_id: testSid,
  owner_id: ownerActor.id,
  created_at: new Date().toISOString(),
});

// Also register evidence ownership (same sid maps to evidence)
ownershipRegistry.registerOwnership({
  resource_kind: "evidence",
  resource_id: testSid,
  owner_id: ownerActor.id,
  created_at: new Date().toISOString(),
});

// Register ownership for test workspace
ownershipRegistry.registerOwnership({
  resource_kind: "workspace",
  resource_id: testWorkspaceId,
  owner_id: creatorActor.id,
  created_at: new Date().toISOString(),
});

console.log("\nsessionGuard — ownership checks:");

test("owner can access own session stream", () => {
  const result = sessionGuard(ownerActor, "agent.stream", testSid);
  assert.equal(result.allowed, true);
});

test("non-owner CANNOT access other user's session stream", () => {
  const result = sessionGuard(otherUserActor, "agent.stream", testSid);
  assert.equal(result.allowed, false);
  // public role is denied because agent.stream requires creator+ role
  assert.ok(result.reason);
});

test("non-owner CANNOT access other user's session status", () => {
  const result = sessionGuard(otherUserActor, "agent.status", testSid);
  assert.equal(result.allowed, false);
});

test("system actor can access any session", () => {
  const result = sessionGuard(systemActor, "agent.stream", testSid);
  assert.equal(result.allowed, true);
});

test("internal actor can access any session", () => {
  const result = sessionGuard(internalActor, "agent.status", testSid);
  assert.equal(result.allowed, true);
});

test("owner can run agent on own session", () => {
  const result = sessionGuard(ownerActor, "agent.run", testSid);
  assert.equal(result.allowed, true);
});

test("anyone can run agent (run doesn't require ownership)", () => {
  const result = sessionGuard(otherUserActor, "agent.run", "sid_new");
  assert.equal(result.allowed, true);
});

console.log("\nevidenceGuard — ownership checks:");

test("owner can verify own evidence", () => {
  const result = evidenceGuard(ownerActor, "evidence.verify", testSid);
  assert.equal(result.allowed, true);
});

test("non-owner CANNOT verify other user's evidence", () => {
  const result = evidenceGuard(otherUserActor, "evidence.verify", testSid);
  assert.equal(result.allowed, false);
});

test("system actor can verify any evidence", () => {
  const result = evidenceGuard(systemActor, "evidence.verify", testSid);
  assert.equal(result.allowed, true);
});

console.log("\nauthzGuard — action-specific checks:");

test("public actor CANNOT write to workspace they don't own", () => {
  const publicActor = resolveActor("tg:123456")!;
  const result = authzGuard(publicActor, "workspace.write", "workspace", testWorkspaceId);
  assert.equal(result.allowed, false);
});

test("workspace owner CAN write to workspace", () => {
  const result = authzGuard(creatorActor, "workspace.write", "workspace", testWorkspaceId);
  assert.equal(result.allowed, true);
});

test("deny result includes reason", () => {
  const result = sessionGuard(otherUserActor, "agent.stream", testSid);
  assert.ok(result.reason);
  assert.ok(result.reason!.length > 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
