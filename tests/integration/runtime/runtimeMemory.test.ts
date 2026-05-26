import { describe, it, before } from "node:test";
import assert from "node:assert";
import { loadStore, getMemory, setMemory, getMemoriesByCategory, getAllMemories, deleteMemory, memorySummary } from "../../../src/runtime/memory/runtime-memory-store.js";
import { getOrCreateSession, addTurn, getRecentTurns, clearSession, getActiveSessionCount } from "../../../src/runtime/memory/session-memory.js";
import { recordOperation, getOperationalHistory, recordRuntimeEvent, getRuntimeEvents, getOperationalSummary } from "../../../src/runtime/memory/operational-memory.js";
import { getCreatorProfile, updateCreatorInteraction, updateCreatorPreferences, getCreatorSummary } from "../../../src/runtime/memory/creator-relationship.js";
import { reconcileMemory, getConflictLog, clearConflicts } from "../../../src/runtime/memory/memory-reconciliation.js";
import { initializeIdentityMemory, getIdentityState, isIdentityContinuityMaintained } from "../../../src/runtime/memory/identity-persistence.js";
import { initializeFacts } from "../../../src/runtime/identity/runtime-facts.js";

describe("Runtime Memory Layer", () => {
  before(() => {
    loadStore();
    initializeFacts();
  });

  describe("runtime-memory-store", () => {
    it("should set and get memory", () => {
      setMemory("test.key", "test-value", "test", true);
      const mem = getMemory("test.key");
      assert.ok(mem);
      assert.strictEqual(mem?.value, "test-value");
      assert.strictEqual(mem?.category, "test");
      deleteMemory("test.key");
    });

    it("should return memories by category", () => {
      setMemory("cat-test-1", "v1", "test-cat", true);
      setMemory("cat-test-2", "v2", "test-cat", true);
      const cats = getMemoriesByCategory("test-cat");
      assert.strictEqual(cats.length, 2);
      deleteMemory("cat-test-1");
      deleteMemory("cat-test-2");
    });

    it("should delete memory", () => {
      setMemory("delete-test", "x", "test", true);
      deleteMemory("delete-test");
      const mem = getMemory("delete-test");
      assert.strictEqual(mem, undefined);
    });
  });

  describe("session-memory", () => {
    it("should create and retrieve session", () => {
      const session = getOrCreateSession("session-test-1");
      assert.ok(session);
      assert.strictEqual(session.chatId, "session-test-1");
      clearSession("session-test-1");
    });

    it("should track turns", () => {
      addTurn("session-test-2", "user", "hello");
      addTurn("session-test-2", "assistant", "hi there");
      addTurn("session-test-2", "user", "how are you");
      const turns = getRecentTurns("session-test-2", 2);
      assert.strictEqual(turns.length, 2);
      assert.strictEqual(turns[0].content, "hi there");
      assert.strictEqual(turns[1].content, "how are you");
      clearSession("session-test-2");
    });

    it("should track active session count", () => {
      const before = getActiveSessionCount();
      getOrCreateSession("count-test");
      const after = getActiveSessionCount();
      assert.strictEqual(after, before + 1);
      clearSession("count-test");
    });
  });

  describe("operational-memory", () => {
    it("should record and retrieve operations", () => {
      recordOperation("test_op", "test detail");
      const ops = getOperationalHistory();
      const found = ops.some(o => o.action === "test_op");
      assert.strictEqual(found, true);
    });

    it("should record runtime events", () => {
      recordRuntimeEvent("test_event", "event detail");
      const events = getRuntimeEvents();
      const found = events.some(e => e.action === "test_event");
      assert.strictEqual(found, true);
    });
  });

  describe("creator-relationship", () => {
    it("should create default profile for new user", () => {
      const profile = getCreatorProfile("test-user-1");
      assert.strictEqual(profile.userId, "test-user-1");
      assert.strictEqual(profile.role, "creator");
      assert.strictEqual(profile.interactionCount, 0);
    });

    it("should update interaction count", () => {
      const uid = `test-user-${Date.now()}`;
      updateCreatorInteraction(uid);
      const profile = getCreatorProfile(uid);
      assert.strictEqual(profile.interactionCount, 1);
    });

    it("should update preferences", () => {
      const uid = `test-user-prefs-${Date.now()}`;
      updateCreatorPreferences(uid, { preferredModel: "test-model" });
      const profile = getCreatorProfile(uid);
      assert.strictEqual(profile.preferredModel, "test-model");
    });
  });

  describe("memory-reconciliation", () => {
    it("should reject claim that contradicts runtime fact", () => {
      const result = reconcileMemory("user_claimed.hardware.cpu", "you have i3", "i3");
      assert.strictEqual(result.accepted, false);
      assert.ok(result.resolvedValue.toString().includes("i7"));
      assert.ok(result.reason.includes("runtime fact"));
    });

    it("should accept claim with no contradicting fact", () => {
      const result = reconcileMemory("user_claimed.user.name", "my name is John", "John");
      assert.strictEqual(result.accepted, true);
      deleteMemory("user_claimed.user.name");
    });
  });

  describe("identity-persistence", () => {
    it("should initialize identity state", () => {
      initializeIdentityMemory();
      const state = getIdentityState();
      assert.ok(state);
      assert.ok(state!.initializedAt > 0);
    });
  });
});
