import { describe, it, before, afterEach } from "node:test";
import assert from "node:assert";
import { createAction, createTask } from "../../../src/runtime/execution/execution-types.js";
import { loadTasks, addTask, getTask, deleteTask, getAllTasks } from "../../../src/runtime/execution/execution-store.js";
import { checkAction, classifyActionRisk } from "../../../src/runtime/governance/governance-gate.js";
import { getPolicy, setPolicy, resetPolicy } from "../../../src/runtime/governance/governance-policy.js";
import { requestApproval, approveAction, rejectAction, getPendingApprovals, getApprovalsForTask } from "../../../src/runtime/governance/governance-approval.js";
import { initBudget, recordExecution, recordBlocked, canAcceptNewTask, releaseBudget, getBudget } from "../../../src/runtime/governance/governance-budget.js";
import { recordBlockedAction, getBlockedActionsForTask, getAllBlockedActions } from "../../../src/runtime/governance/governance-evidence.js";
import { loadStore } from "../../../src/runtime/memory/runtime-memory-store.js";

describe("Runtime Governance Layer", () => {
  before(() => {
    loadStore();
    loadTasks();
  });

  afterEach(() => {
    resetPolicy();
  });

  describe("governance-policy", () => {
    it("should have default policy", () => {
      const policy = getPolicy();
      assert.ok(policy.allowedShellPrefixes.length > 0);
      assert.ok(policy.blockedShellPatterns.length > 0);
      assert.ok(policy.allowedFileWritePrefixes.length > 0);
      assert.strictEqual(policy.maxActionsPerTask, 20);
    });

    it("should allow overriding policy", () => {
      setPolicy({ maxActionsPerTask: 5 });
      assert.strictEqual(getPolicy().maxActionsPerTask, 5);
    });
  });

  describe("governance-gate", () => {
    it("should allow safe shell command", () => {
      const action = createAction("shell", "echo", { command: "echo hello" });
      const decision = checkAction(action);
      assert.strictEqual(decision.blocked, false);
      assert.strictEqual(decision.verdict, "allow");
    });

    it("should block critical shell command", () => {
      const action = createAction("shell", "rm rf", { command: "rm -rf /" });
      const decision = checkAction(action);
      assert.strictEqual(decision.blocked, true);
      assert.strictEqual(decision.risk, "critical");
    });

    it("should require approval for unknown shell command", () => {
      const action = createAction("shell", "custom", { command: "my_custom_tool --do-stuff" });
      const decision = checkAction(action);
      assert.strictEqual(decision.requiresApproval, true);
      assert.strictEqual(decision.risk, "high");
    });

    it("should allow safe file write to /tmp", () => {
      const action = createAction("file_write", "write tmp", { path: "/tmp/test.txt", content: "data" });
      const decision = checkAction(action);
      assert.strictEqual(decision.blocked, false);
    });

    it("should block file write to /etc", () => {
      const action = createAction("file_write", "write etc", { path: "/etc/passwd", content: "evil" });
      const decision = checkAction(action);
      assert.strictEqual(decision.blocked, true);
      assert.strictEqual(decision.risk, "critical");
    });

    it("should allow allowed HTTP domain", () => {
      const action = createAction("http", "github", { url: "https://api.github.com/repos" });
      const decision = checkAction(action);
      assert.strictEqual(decision.blocked, false);
    });

    it("should flag unknown HTTP domain as high risk", () => {
      const action = createAction("http", "unknown", { url: "https://evil-malware.com/payload" });
      const decision = checkAction(action);
      assert.strictEqual(decision.requiresApproval, true);
    });

    it("should allow verify action", () => {
      const action = createAction("verify", "check", { check: "hello", expected: "hello" });
      const decision = checkAction(action);
      assert.strictEqual(decision.blocked, false);
      assert.strictEqual(decision.risk, "safe");
    });
  });

  describe("governance-approval", () => {
    it("should create and approve request", () => {
      const req = requestApproval("task-1", "act-1", "dangerous action", "shell", "high", "unknown command", { command: "foo" });
      assert.strictEqual(req.status, "pending");
      const approved = approveAction(req.id);
      assert.strictEqual(approved?.status, "approved");
    });

    it("should create and reject request", () => {
      const req = requestApproval("task-2", "act-2", "risky action", "shell", "high", "suspicious", { command: "bar" });
      const rejected = rejectAction(req.id);
      assert.strictEqual(rejected?.status, "rejected");
    });

    it("should list pending approvals", () => {
      requestApproval("task-3", "act-3", "pending action", "http", "high", "unknown domain", { url: "https://test.xyz" });
      const pending = getPendingApprovals();
      assert.ok(pending.length >= 1);
    });

    it("should filter by task", () => {
      requestApproval("task-4", "act-4", "task 4 action", "shell", "high", "needs review", { command: "custom" });
      const forTask = getApprovalsForTask("task-4");
      assert.ok(forTask.length >= 1);
    });
  });

  describe("governance-budget", () => {
    it("should track execution count", () => {
      initBudget("budget-task-1");
      assert.ok(recordExecution("budget-task-1"));
      const budget = getBudget("budget-task-1");
      assert.strictEqual(budget?.actionsExecuted, 1);
      releaseBudget("budget-task-1");
    });

    it("should block over budget", () => {
      setPolicy({ maxActionsPerTask: 3 });
      initBudget("budget-task-2");
      recordExecution("budget-task-2");
      recordExecution("budget-task-2");
      recordExecution("budget-task-2");
      assert.strictEqual(recordExecution("budget-task-2"), false);
      releaseBudget("budget-task-2");
    });
  });

  describe("governance-evidence", () => {
    it("should record blocked actions", () => {
      recordBlockedAction("task-e-1", "act-e-1", "blocked shell", "shell", "high", "suspicious command");
      const blocked = getBlockedActionsForTask("task-e-1");
      assert.strictEqual(blocked.length, 1);
      assert.strictEqual(blocked[0].actionLabel, "blocked shell");
    });

    it("should list all blocked", () => {
      recordBlockedAction("task-e-2", "act-e-2", "another block", "http", "critical", "blocked domain");
      const all = getAllBlockedActions();
      assert.ok(all.length >= 2);
    });
  });

  describe("governance integration with execution", () => {
    it("should run safe task through engine", async () => {
      const action = createAction("shell", "echo hi", { command: "echo hello_from_governance" });
      const task = createTask("g-test", "governance safe task", [action]);
      await addTask(task);

      const { enqueueTask, runTask } = await import("../../../src/runtime/execution/execution-engine.js");
      await enqueueTask(task);
      const result = await runTask(task.id);
      assert.strictEqual(result.status, "done");
      assert.strictEqual(result.actions[0].status, "done");
      deleteTask(task.id);
    });

    it("should block critical shell in engine", async () => {
      const action = createAction("shell", "dangerous", { command: "rm -rf /" });
      const task = createTask("g-test", "governance block test", [action]);
      await addTask(task);

      const { enqueueTask, runTask } = await import("../../../src/runtime/execution/execution-engine.js");
      await enqueueTask(task);
      const result = await runTask(task.id);
      assert.strictEqual(result.status, "failed");
      assert.ok(result.evidence.some(e => e.includes("governance_blocked") || e.includes("action_failed")));
      deleteTask(task.id);
    });

    it("should allow unknown shell with auto-approval", async () => {
      const action = createAction("shell", "custom tool", { command: "my_custom_script --version" });
      const task = createTask("g-test", "governance auth test", [action]);
      await addTask(task);

      const { enqueueTask, runTask } = await import("../../../src/runtime/execution/execution-engine.js");
      await enqueueTask(task);
      const result = await runTask(task.id);
      // custom shell won't actually work, but should fail on execution not governance
      assert.strictEqual(result.status, "failed");
      // it should fail because my_custom_script doesn't exist, not because governance blocked it
      assert.ok(!result.evidence.some(e => e.includes("governance_blocked")));
      deleteTask(task.id);
    });
  });
});
