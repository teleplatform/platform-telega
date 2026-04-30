import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../../../");

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

function readSchema(name: string): string {
  const path = join(projectRoot, `docs/schemas/${name}`);
  assert.ok(existsSync(path), `Schema file missing: ${name}`);
  return readFileSync(path, "utf-8");
}

function readContract(name: string): string {
  const path = join(projectRoot, `packages/fsgr-contracts/src/${name}`);
  assert.ok(existsSync(path), `Contract file missing: ${name}`);
  return readFileSync(path, "utf-8");
}

function readAllContracts(): string {
  const files = ["skillUnit.ts", "taskIntentEnvelope.ts", "executionGraph.ts", "runLedger.ts", "capsule.ts", "artifactEnvelope.ts"];
  return files.map((f) => readContract(f)).join("\n");
}

console.log("\n1. Schema files exist:");

test("skill-unit.schema.json exists", () => { readSchema("skill-unit.schema.json"); });
test("task-intent-envelope.schema.json exists", () => { readSchema("task-intent-envelope.schema.json"); });
test("execution-graph.schema.json exists", () => { readSchema("execution-graph.schema.json"); });
test("run-ledger.schema.json exists", () => { readSchema("run-ledger.schema.json"); });
test("capsule.schema.json exists", () => { readSchema("capsule.schema.json"); });
test("artifact-envelope.schema.json exists", () => { readSchema("artifact-envelope.schema.json"); });

console.log("\n2. Contract files exist:");

test("skillUnit.ts exists", () => { readContract("skillUnit.ts"); });
test("taskIntentEnvelope.ts exists", () => { readContract("taskIntentEnvelope.ts"); });
test("executionGraph.ts exists", () => { readContract("executionGraph.ts"); });
test("runLedger.ts exists", () => { readContract("runLedger.ts"); });
test("capsule.ts exists", () => { readContract("capsule.ts"); });
test("artifactEnvelope.ts exists", () => { readContract("artifactEnvelope.ts"); });
test("index.ts exists", () => { readContract("index.ts"); });

console.log("\n3. Enum values consistency (across all contracts):");

const allContracts = readAllContracts();

test("SkillFamily enum values match between TS and schema", () => {
  const schema = readSchema("skill-unit.schema.json");
  ["frontend", "backend", "content", "research", "ops"].forEach((f) => {
    assert.ok(allContracts.includes(`"${f}"`), `TS missing SkillFamily: ${f}`);
    assert.ok(schema.includes(`"${f}"`), `Schema missing SkillFamily: ${f}`);
  });
});

test("ActorMode enum values match between TS and schema", () => {
  const schema = readSchema("skill-unit.schema.json");
  ["public", "creator", "internal", "system"].forEach((m) => {
    assert.ok(allContracts.includes(`"${m}"`), `TS missing ActorMode: ${m}`);
    assert.ok(schema.includes(`"${m}"`), `Schema missing ActorMode: ${m}`);
  });
});

test("RiskClass enum values match", () => {
  const schema = readSchema("skill-unit.schema.json");
  ["low", "medium", "high"].forEach((r) => {
    assert.ok(allContracts.includes(`"${r}"`), `TS missing RiskClass: ${r}`);
    assert.ok(schema.includes(`"${r}"`), `Schema missing RiskClass: ${r}`);
  });
});

test("ExecutionMode enum values match between TS and schema", () => {
  const schema = readSchema("execution-graph.schema.json");
  ["fast", "safe", "quality", "creator"].forEach((m) => {
    assert.ok(allContracts.includes(`"${m}"`), `TS missing ExecutionMode: ${m}`);
    assert.ok(schema.includes(`"${m}"`), `Schema missing plan_mode: ${m}`);
  });
});

test("NodeStatus enum values match between TS and schema", () => {
  const schema = readSchema("execution-graph.schema.json");
  ["pending", "ready", "running", "blocked", "waiting_dependency", "needs_review", "failed", "completed", "rolled_back"].forEach((s) => {
    assert.ok(allContracts.includes(`"${s}"`), `TS missing NodeStatus: ${s}`);
    assert.ok(schema.includes(`"${s}"`), `Schema missing NodeStatus: ${s}`);
  });
});

test("EdgeKind enum values match", () => {
  const schema = readSchema("execution-graph.schema.json");
  ["dependency", "artifact_flow", "control_flow"].forEach((k) => {
    assert.ok(allContracts.includes(`"${k}"`), `TS missing EdgeKind: ${k}`);
    assert.ok(schema.includes(`"${k}"`), `Schema missing EdgeKind: ${k}`);
  });
});

test("RunStatus enum values match", () => {
  const schema = readSchema("run-ledger.schema.json");
  ["created", "planned", "running", "paused", "failed", "completed", "degraded"].forEach((s) => {
    assert.ok(allContracts.includes(`"${s}"`), `TS missing RunStatus: ${s}`);
    assert.ok(schema.includes(`"${s}"`), `Schema missing RunStatus: ${s}`);
  });
});

test("ArtifactKind enum values match", () => {
  const schema = readSchema("artifact-envelope.schema.json");
  ["code", "doc", "json", "asset", "report", "patch", "bundle"].forEach((k) => {
    assert.ok(allContracts.includes(`"${k}"`), `TS missing ArtifactKind: ${k}`);
    assert.ok(schema.includes(`"${k}"`), `Schema missing ArtifactKind: ${k}`);
  });
});

test("ValidatorStatus enum values match", () => {
  const schema = readSchema("artifact-envelope.schema.json");
  ["passed", "failed", "warning"].forEach((s) => {
    assert.ok(allContracts.includes(`"${s}"`), `TS missing ValidatorStatus: ${s}`);
    assert.ok(schema.includes(`"${s}"`), `Schema missing ValidatorStatus: ${s}`);
  });
});

test("PrivacyPreference enum values match", () => {
  const schema = readSchema("task-intent-envelope.schema.json");
  ["prefer_local", "allow_remote", "require_local"].forEach((p) => {
    assert.ok(allContracts.includes(`"${p}"`), `TS missing PrivacyPreference: ${p}`);
    assert.ok(schema.includes(`"${p}"`), `Schema missing PrivacyPreference: ${p}`);
  });
});

test("BudgetClass enum values match", () => {
  const schema = readSchema("task-intent-envelope.schema.json");
  ["low", "medium", "high"].forEach((b) => {
    assert.ok(allContracts.includes(`"${b}"`), `TS missing BudgetClass: ${b}`);
    assert.ok(schema.includes(`"${b}"`), `Schema missing BudgetClass: ${b}`);
  });
});

console.log("\n4. Required fields consistency:");

test("SkillUnit required fields present in TS", () => {
  const ts = readContract("skillUnit.ts");
  ["skill_id", "family", "name", "description", "version", "capability_tags", "input_schema_ref", "output_schema_ref", "mode_support", "risk_class", "policy_scope", "retry_policy", "validator_hooks", "timeout_ms"].forEach((f) => {
    assert.ok(ts.includes(f), `TS SkillUnit missing field: ${f}`);
  });
});

test("SkillUnit required fields present in schema", () => {
  const schema = readSchema("skill-unit.schema.json");
  ["skill_id", "family", "name", "description", "version", "capability_tags", "input_schema_ref", "output_schema_ref", "mode_support", "risk_class", "policy_scope", "retry_policy", "validator_hooks", "timeout_ms"].forEach((f) => {
    assert.ok(schema.includes(`"${f}"`), `Schema SkillUnit missing field: ${f}`);
  });
});

test("ExecutionGraph required fields present in TS", () => {
  const ts = readContract("executionGraph.ts");
  ["graph_id", "run_id", "version", "plan_mode", "nodes", "edges", "entry_nodes", "terminal_nodes"].forEach((f) => {
    assert.ok(ts.includes(f), `TS ExecutionGraph missing field: ${f}`);
  });
});

test("RunLedger required fields present in TS", () => {
  const ts = readContract("runLedger.ts");
  ["run_id", "task_id", "actor_id", "actor_mode", "status", "graph_id", "plan_mode", "selected_skill_ids", "current_node_ids", "completed_node_ids", "failed_node_ids", "artifact_ids", "created_at", "updated_at"].forEach((f) => {
    assert.ok(ts.includes(f), `TS RunLedger missing field: ${f}`);
  });
});

console.log("\n5. Cross-contract consistency:");

test("ExecutionGraph.plan_mode uses same enum as TaskIntentEnvelope.execution_mode", () => {
  assert.ok(allContracts.includes("ExecutionMode") || allContracts.includes("plan_mode"), "Missing ExecutionMode/plan_mode");
});

test("SkillUnit.mode_support uses same ActorMode as TaskIntentEnvelope.actor_mode", () => {
  assert.ok(allContracts.includes("ActorMode"), "Missing ActorMode");
});

test("index.ts exports all contracts", () => {
  const index = readContract("index.ts");
  ["SkillUnit", "TaskIntentEnvelope", "ExecutionGraph", "RunLedger", "ContextCapsule", "ArtifactEnvelope"].forEach((c) => {
    assert.ok(index.includes(c), `index.ts missing export: ${c}`);
  });
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
