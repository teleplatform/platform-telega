import { describe, it, before } from "node:test";
import assert from "node:assert";
import { createGoal, isGoalStale, isGoalAbandoned } from "../../../src/runtime/goals/goal-types.js";
import { loadGoals, addGoal, getGoal, getAllGoals, updateGoal, deleteGoal, getActiveGoals, goalSummary } from "../../../src/runtime/goals/goal-store.js";
import { createAndStoreGoal, advanceGoal, completeGoal, failGoal, pauseGoal, resumeGoal, markStepDone, getGoalInventory } from "../../../src/runtime/goals/goal-engine.js";
import { recoverGoals, getUnfinishedBusiness } from "../../../src/runtime/goals/goal-recovery.js";
import { prioritizeGoals, getAbandonedAlert, getWhatMatters } from "../../../src/runtime/goals/goal-prioritizer.js";

describe("Runtime Goals Layer", () => {
  before(() => {
    loadGoals();
  });

  describe("goal-types", () => {
    it("should create a goal with defaults", () => {
      const goal = createGoal({ title: "Test Goal", description: "A test" });
      assert.ok(goal.id);
      assert.strictEqual(goal.title, "Test Goal");
      assert.strictEqual(goal.status, "active");
      assert.strictEqual(goal.priority, "medium");
      assert.strictEqual(goal.progress, 0);
    });

    it("should detect stale goal", () => {
      const goal = createGoal({ title: "Stale Test", description: "Stale" });
      const oldGoal = { ...goal, updatedAt: Date.now() - 25 * 60 * 60 * 1000 };
      assert.strictEqual(isGoalStale(oldGoal, 24), true);
    });

    it("should detect abandoned goal", () => {
      const goal = createGoal({ title: "Abandoned Test", description: "Abandoned" });
      const oldGoal = { ...goal, updatedAt: Date.now() - 73 * 60 * 60 * 1000 };
      assert.strictEqual(isGoalAbandoned(oldGoal), true);
    });
  });

  describe("goal-store", () => {
    it("should add and retrieve goal", () => {
      const goal = createGoal({ title: "Store Test", description: "Store test" });
      addGoal(goal);
      const retrieved = getGoal(goal.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved!.title, "Store Test");
      deleteGoal(goal.id);
    });

    it("should update goal", () => {
      const goal = createGoal({ title: "Update Test", description: "Update test" });
      addGoal(goal);
      updateGoal(goal.id, { progress: 50, nextStep: "halfway" });
      const updated = getGoal(goal.id);
      assert.strictEqual(updated!.progress, 50);
      assert.strictEqual(updated!.nextStep, "halfway");
      deleteGoal(goal.id);
    });

    it("should list active goals", () => {
      const g1 = createGoal({ title: "Active 1", description: "A1" });
      const g2 = createGoal({ title: "Active 2", description: "A2" });
      addGoal(g1);
      addGoal(g2);
      updateGoal(g2.id, { status: "paused" });
      const active = getActiveGoals();
      assert.ok(active.length >= 1);
      deleteGoal(g1.id);
      deleteGoal(g2.id);
    });
  });

  describe("goal-engine", () => {
    it("should create and store goal", () => {
      const goal = createAndStoreGoal({ title: "Engine Test", description: "Engine", priority: "high" });
      assert.ok(goal.id);
      assert.strictEqual(goal.priority, "high");
      deleteGoal(goal.id);
    });

    it("should advance goal progress", () => {
      const goal = createAndStoreGoal({ title: "Advance Test", description: "Advance" });
      advanceGoal(goal.id, 50, "middle");
      const updated = getGoal(goal.id);
      assert.strictEqual(updated!.progress, 50);
      assert.strictEqual(updated!.nextStep, "middle");
      deleteGoal(goal.id);
    });

    it("should complete goal", () => {
      const goal = createAndStoreGoal({ title: "Complete Test", description: "Complete" });
      completeGoal(goal.id);
      const updated = getGoal(goal.id);
      assert.strictEqual(updated!.status, "completed");
      assert.strictEqual(updated!.progress, 100);
      deleteGoal(goal.id);
    });

    it("should pause and resume goal", () => {
      const goal = createAndStoreGoal({ title: "Pause Test", description: "Pause" });
      pauseGoal(goal.id);
      assert.strictEqual(getGoal(goal.id)!.status, "paused");
      resumeGoal(goal.id);
      assert.strictEqual(getGoal(goal.id)!.status, "active");
      deleteGoal(goal.id);
    });

    it("should fail goal", () => {
      const goal = createAndStoreGoal({ title: "Fail Test", description: "Fail" });
      failGoal(goal.id, "test failure");
      assert.strictEqual(getGoal(goal.id)!.status, "failed");
      deleteGoal(goal.id);
    });

    it("should mark step as done", () => {
      const steps = [
        { id: "s1", description: "Step 1", status: "pending" as const, order: 1 },
        { id: "s2", description: "Step 2", status: "pending" as const, order: 2 },
      ];
      const goal = createAndStoreGoal({ title: "Steps Test", description: "Steps", steps });
      markStepDone(goal.id, "s1");
      const updated = getGoal(goal.id);
      assert.strictEqual(updated!.steps[0].status, "done");
      assert.strictEqual(updated!.progress, 50);
      deleteGoal(goal.id);
    });
  });

  describe("goal-recovery", () => {
    it("should recover active goals", () => {
      const goal = createAndStoreGoal({ title: "Recovery Test", description: "Recovery" });
      const report = recoverGoals();
      assert.ok(report.total >= 1);
      const recovered = report.details.some(d => d.includes(goal.title));
      assert.strictEqual(recovered, true);
      deleteGoal(goal.id);
    });
  });

  describe("goal-prioritizer", () => {
    it("should prioritize goals", () => {
      const critical = createAndStoreGoal({ title: "Critical Goal", description: "Critical", priority: "critical" });
      const low = createAndStoreGoal({ title: "Low Goal", description: "Low", priority: "low" });
      const prioritized = prioritizeGoals();
      assert.ok(prioritized.length >= 2);
      const criticalScore = prioritized.find(p => p.goal.id === critical.id);
      const lowScore = prioritized.find(p => p.goal.id === low.id);
      assert.ok(criticalScore);
      assert.ok(lowScore);
      assert.ok(criticalScore!.urgencyScore > lowScore!.urgencyScore);
      deleteGoal(critical.id);
      deleteGoal(low.id);
    });

    it("should return what matters", () => {
      const goal = createAndStoreGoal({ title: "Matters Test", description: "Matters", priority: "high" });
      const matters = getWhatMatters();
      assert.ok(matters.includes("Matters Test"));
      deleteGoal(goal.id);
    });
  });
});
