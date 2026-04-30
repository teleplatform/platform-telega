import type { TaskIntentEnvelope, RunLedger, ExecutionGraph } from "../../../fsgr-contracts/src/index.js";
import type { FsgrRuntime } from "../runtime/initRuntime.js";
import { normalizeTaskIntent } from "../intake/normalizeTask.js";
import { classifyTaskIntent } from "../intake/classifyTask.js";
import { resolvePlanMode } from "../planning/planModes.js";
import { decomposeTask } from "../planning/decompose.js";
import { buildExecutionGraph } from "../planning/dagBuilder.js";
import { retrieveCandidateSkills } from "../skills/retrieval.js";
import { selectSkillsForTask } from "../skills/selection.js";
import { buildContextCapsule } from "../capsule/capsuleBuilder.js";
import { makeRunId, makeGraphId, makeCapsuleId } from "../utils/ids.js";
import { nowIso } from "../utils/now.js";
import { registerCoreSkills, CORE_SKILLS } from "../../../fsgr-skills-core/src/index.js";

export interface StartRunResult {
  ledger: RunLedger;
  graph: ExecutionGraph;
  capsule: any;
  selection: { selected_count: number; rejected_count: number };
}

export async function startFsgrRun(
  runtime: FsgrRuntime,
  envelope: TaskIntentEnvelope
): Promise<StartRunResult> {
  const normalized = normalizeTaskIntent(envelope);
  const classified = classifyTaskIntent(normalized);
  const planMode = resolvePlanMode(normalized, classified);

  const registry = runtime.skillRegistry ?? createDefaultRegistry();
  const candidates = retrieveCandidateSkills(normalized, registry);
  const selection = selectSkillsForTask(normalized, candidates);

  const workUnits = decomposeTask(normalized, selection.selected, classified, planMode);
  const { graph, errors } = buildExecutionGraph("", normalized, workUnits, planMode);
  if (errors.length > 0) throw new Error(`DAG build failed: ${errors.join(", ")}`);

  const runId = makeRunId();
  graph.run_id = runId;
  graph.graph_id = makeGraphId();

  // Set run_id on nodes for persistence
  for (const node of graph.nodes) {
    (node as any).run_id = runId;
  }

  const now = nowIso();
  const ledger: RunLedger = {
    run_id: runId,
    task_id: normalized.task_id,
    actor_id: normalized.actor_id,
    actor_mode: normalized.actor_mode,
    status: "planned",
    graph_id: graph.graph_id,
    plan_mode: planMode,
    selected_skill_ids: selection.selected.map((s) => s.skill_id),
    current_node_ids: graph.entry_nodes,
    completed_node_ids: [],
    failed_node_ids: [],
    artifact_ids: [],
    trace_id: normalized.trace_id,
    resume_token: `resume_${makeRunId()}`,
    created_at: now,
    updated_at: now,
  };

  runtime.ledgerStore.createRun(ledger);
  runtime.repos.nodes.createNodes(graph.nodes as any);

  runtime.ledgerStore.appendEvent({ run_id: runId, event_type: "run.created", payload: { task_id: normalized.task_id, actor_mode: normalized.actor_mode } });
  runtime.ledgerStore.appendEvent({ run_id: runId, event_type: "plan.built", payload: { node_count: graph.nodes.length, edge_count: graph.edges.length, plan_mode: planMode } });

  const nodes = graph.nodes as any[];
  const events = runtime.ledgerStore.getEvents(runId);
  const capsule = buildContextCapsule(runId, ledger, nodes, events);
  runtime.ledgerStore.saveCapsule({ capsule_id: capsule.capsule_id, run_id: runId, capsule_json: JSON.stringify(capsule) });
  runtime.ledgerStore.appendEvent({ run_id: runId, event_type: "capsule.updated", payload: { capsule_id: capsule.capsule_id } });

  return { ledger, graph, capsule, selection: { selected_count: selection.selected.length, rejected_count: selection.rejected.length } };
}

let defaultRegistry: any = null;
function createDefaultRegistry() {
  if (!defaultRegistry) {
    const { createSkillRegistry } = require("../skills/registry.js");
    defaultRegistry = createSkillRegistry();
    registerCoreSkills(defaultRegistry);
  }
  return defaultRegistry;
}
