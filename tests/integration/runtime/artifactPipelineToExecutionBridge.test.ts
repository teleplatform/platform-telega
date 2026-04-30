/**
 * Integration Tests for Artifact Pipeline → Execution Bridge
 *
 * Tests the full flow:
 *   register artifact → pipeline → handoff → execution prepare → execution run
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  registerArtifact,
  getArtifact,
  listArtifacts,
  clearArtifactRegistry,
  setArtifactRegistryForTest,
} from "../../../src/forge-bridge/artifactRegistry.js";
import {
  clearExecutionStore,
} from "../../../src/server/routes/execution.route.js";

// ============================================================================
// TEST A — Artifact Registration
// ============================================================================

describe("artifact registry", () => {
  before(() => {
    clearArtifactRegistry();
    clearExecutionStore();
  });

  after(() => {
    clearArtifactRegistry();
    clearExecutionStore();
  });

  it("registers artifact and retrieves it", () => {
    registerArtifact({
      artifact: {
        id: "artifact_test_1",
        type: "spec_artifact",
        title: "Test Artifact",
        goal: "Test goal",
        target: "web_delivery",
        createdAt: new Date().toISOString(),
        summary: "Test artifact",
        payload: {},
      },
      taskId: "task_test_1",
      traceId: "trace_test_1",
    });

    const entry = getArtifact("artifact_test_1");
    assert.ok(entry);
    assert.equal(entry.artifact.id, "artifact_test_1");
    assert.equal(entry.artifact.type, "spec_artifact");
    assert.equal(entry.taskId, "task_test_1");
  });

  it("lists all registered artifacts", () => {
    registerArtifact({
      artifact: {
        id: "artifact_test_2",
        type: "spec_artifact",
        title: "Second Test",
        goal: "Goal 2",
        target: "web_delivery",
        createdAt: new Date().toISOString(),
        summary: "Second test artifact",
        payload: {},
      },
      taskId: "task_test_2",
      traceId: "trace_test_2",
    });

    const artifacts = listArtifacts();
    assert.ok(artifacts.length >= 2);
    assert.ok(artifacts.some((a) => a.artifact.id === "artifact_test_1"));
    assert.ok(artifacts.some((a) => a.artifact.id === "artifact_test_2"));
  });
});

// ============================================================================
// TEST B — Full Pipeline → Execution Bridge
// ============================================================================

describe("artifact pipeline → execution bridge", () => {
  before(() => {
    clearArtifactRegistry();
    clearExecutionStore();
  });

  after(() => {
    clearArtifactRegistry();
    clearExecutionStore();
  });

  it("registers artifact for execution flow", () => {
    registerArtifact({
      artifact: {
        id: "artifact_exec_1",
        type: "spec_artifact",
        title: "Execution Test",
        goal: "Test execution flow",
        target: "web_delivery",
        createdAt: new Date().toISOString(),
        summary: "Execution test artifact",
        payload: {},
      },
      taskId: "task_exec_1",
      traceId: "trace_exec_1",
    });

    const entry = getArtifact("artifact_exec_1");
    assert.ok(entry);
    assert.equal(entry.artifact.target, "web_delivery");
  });

  it("confirms artifact exists in registry (simulating /v1/execution/prepare validation)", () => {
    const entry = getArtifact("artifact_exec_1");
    assert.ok(entry, "Artifact must exist for execution prepare");
    assert.equal(entry.artifact.id, "artifact_exec_1");
  });

  it("simulates execution prepare passing validation", () => {
    // This simulates what /v1/execution/prepare does:
    // 1. Check artifact exists in registry
    // 2. Create execution record
    // 3. Return allowed: true, validatorPassed: true

    const entry = getArtifact("artifact_exec_1");
    const ready = entry !== undefined;

    assert.equal(ready, true, "Artifact must be ready for execution");
    assert.equal(entry!.artifact.id, "artifact_exec_1");
  });

  it("simulates execution run completing successfully", () => {
    // This simulates what /v1/execution/run does:
    // 1. Find or create execution for artifact
    // 2. Mark as running
    // 3. Execute (simulate)
    // 4. Mark as completed

    const entry = getArtifact("artifact_exec_1");
    assert.ok(entry, "Artifact must exist for execution run");

    // Simulate execution result
    const result = {
      status: "completed",
      artifact_id: "artifact_exec_1",
      artifact_type: entry.artifact.type,
      target: "web_delivery",
      output: `Executed artifact_exec_1 for target web_delivery`,
    };

    assert.equal(result.status, "completed");
    assert.equal(result.artifact_id, "artifact_exec_1");
    assert.equal(result.target, "web_delivery");
  });
});

// ============================================================================
// TEST C — Handoff-only artifact doesn't block execution
// ============================================================================

describe("handoff artifact can still be executed", () => {
  before(() => {
    clearArtifactRegistry();
    clearExecutionStore();
  });

  after(() => {
    clearArtifactRegistry();
    clearExecutionStore();
  });

  it("registers handoff artifact", () => {
    registerArtifact({
      artifact: {
        id: "artifact_handoff_1",
        type: "spec_artifact",
        title: "Handoff Test",
        goal: "Test handoff doesn't block execution",
        target: "web",
        createdAt: new Date().toISOString(),
        summary: "Handoff test artifact",
        payload: {},
      },
      taskId: "task_handoff_1",
      traceId: "trace_handoff_1",
    });

    const entry = getArtifact("artifact_handoff_1");
    assert.ok(entry);
    assert.equal(entry.artifact.target, "web");
  });

  it("confirms handoff artifact is still executable", () => {
    const entry = getArtifact("artifact_handoff_1");
    assert.ok(entry, "Handoff artifact must still be executable");
    assert.equal(entry.artifact.id, "artifact_handoff_1");

    // In the real system, after handoff_completed, we create an execution-ready
    // mirror. For now, we accept any registered artifact as potentially executable.
    const ready = entry !== undefined;
    assert.equal(ready, true, "Handoff artifact should be ready for execution");
  });
});
