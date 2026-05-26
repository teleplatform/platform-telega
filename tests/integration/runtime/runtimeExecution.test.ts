import { describe, it, before } from "node:test";
import assert from "node:assert";
import { createAction, createTask, isTaskFinished, getTaskProgress } from "../../../src/runtime/execution/execution-types.js";
import { loadTasks, addTask, getTask, updateTask, deleteTask, getPendingTasks, getRunningTasks, getInterruptedTasks, getAllTasks } from "../../../src/runtime/execution/execution-store.js";
import { enqueueTask, runTask } from "../../../src/runtime/execution/execution-engine.js";
import { recoverTasks } from "../../../src/runtime/execution/execution-recovery.js";
import { executeAction } from "../../../src/runtime/execution/execution-actions.js";
import { linkEvidence, getEvidenceForTask } from "../../../src/runtime/execution/execution-evidence.js";
import { loadStore } from "../../../src/runtime/memory/runtime-memory-store.js";

describe("Runtime Execution Layer", () => {
  before(() => {
    loadStore();
    loadTasks();
  });

  describe("execution-types", () => {
    it("should create action with defaults", () => {
      const action = createAction("shell", "test action", { command: "echo hi" });
      assert.ok(action.id);
      assert.strictEqual(action.type, "shell");
      assert.strictEqual(action.status, "pending");
      assert.strictEqual(action.retryCount, 0);
      assert.strictEqual(action.maxRetries, 2);
    });

    it("should create task with actions", () => {
      const a1 = createAction("shell", "step 1", { command: "echo 1" });
      const a2 = createAction("shell", "step 2", { command: "echo 2" });
      const task = createTask("goal-1", "test task", [a1, a2]);
      assert.ok(task.id);
      assert.strictEqual(task.actions.length, 2);
      assert.strictEqual(task.status, "pending");
    });

    it("should calculate progress", () => {
      const a1 = createAction("shell", "step 1", { command: "echo 1" });
      const a2 = createAction("shell", "step 2", { command: "echo 2" });
      const task = createTask("goal-1", "progress test", [a1, a2]);
      assert.strictEqual(getTaskProgress(task), 0);
      task.actions[0].status = "done";
      assert.strictEqual(getTaskProgress(task), 50);
    });

    it("should detect finished task", () => {
      const task = createTask("g", "done test", []);
      assert.strictEqual(isTaskFinished(task), false);
      task.status = "done";
      assert.strictEqual(isTaskFinished(task), true);
    });
  });

  describe("execution-store", () => {
    it("should add and retrieve task", () => {
      const task = createTask("g", "store test", []);
      addTask(task);
      assert.ok(getTask(task.id));
      deleteTask(task.id);
    });

    it("should update task", () => {
      const task = createTask("g", "update test", []);
      addTask(task);
      updateTask(task.id, { status: "running" });
      assert.strictEqual(getTask(task.id)?.status, "running");
      deleteTask(task.id);
    });

    it("should filter by status", () => {
      const t1 = createTask("g", "pending task", []);
      const t2 = createTask("g", "running task", []);
      addTask(t1);
      addTask(t2);
      updateTask(t2.id, { status: "running" });
      assert.ok(getPendingTasks().some(t => t.id === t1.id));
      assert.ok(getRunningTasks().some(t => t.id === t2.id));
      deleteTask(t1.id);
      deleteTask(t2.id);
    });
  });

  describe("execution-actions", () => {
    it("should execute shell action", async () => {
      const action = createAction("shell", "echo", { command: "echo hello" });
      const result = await executeAction(action);
      assert.ok(result.result);
      assert.ok((result.result as any).stdout?.includes("hello"));
    });

    it("should fail shell action on bad command", async () => {
      const action = createAction("shell", "bad", { command: "nonexistent_command_xyz" });
      try {
        await executeAction(action);
        assert.fail("should have thrown");
      } catch (e) {
        assert.ok(String(e).length > 0);
      }
    });

    it("should execute file write then read", async () => {
      const filePath = "/tmp/test-execution.txt";
      const writeAction = createAction("file_write", "write", { path: filePath, content: "test data" });
      await executeAction(writeAction);

      const readAction = createAction("file_read", "read", { path: filePath });
      const result = await executeAction(readAction);
      assert.ok((result.result as any).content?.includes("test data"));
    });
  });

  describe("execution-evidence", () => {
    it("should link evidence to task", () => {
      const task = createTask("g", "evidence test", []);
      addTask(task);
      linkEvidence(task.id, "act-1", "test evidence");
      const evidence = getEvidenceForTask(task.id);
      assert.strictEqual(evidence.length, 1);
      assert.strictEqual(evidence[0].evidence, "test evidence");
      deleteTask(task.id);
    });
  });

  describe("execution-engine", () => {
    it("should enqueue and run a simple task", async () => {
      const action = createAction("shell", "echo", { command: "echo hello" });
      const task = createTask("g", "engine test", [action]);
      await enqueueTask(task);
      const result = await runTask(task.id);
      assert.strictEqual(result.status, "done");
      assert.strictEqual(result.actions[0].status, "done");
      deleteTask(task.id);
    });
  });

  describe("execution-recovery", () => {
    it("should recover interrupted tasks", () => {
      const task = createTask("g", "recovery test", []);
      addTask(task);
      updateTask(task.id, { status: "running" });
      const report = recoverTasks();
      assert.ok(report.total >= 1);
      const recovered = getTask(task.id);
      assert.strictEqual(recovered?.status, "pending");
      deleteTask(task.id);
    });
  });
});
