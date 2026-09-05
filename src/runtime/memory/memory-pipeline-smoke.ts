/**
 * TGR-6.97 — Memory Pipeline Regression Gate (attach → retrieve → writeback)
 */

import fs from "node:fs";
import path from "node:path";
import { initExecutionEvidenceStore, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import {
  attachMemoryContext,
  clearActiveTaskStore,
  type MemoryAttachment,
} from "./memory-context-attachment.js";
import { retrieveMemoryForPrompt } from "./memory-retrieval-guard.js";
import { writebackMemory } from "./memory-writeback.js";
import { getRecentTurns, clearSession } from "./session-memory.js";
import { buildCanonicalDecisionKey, buildTaskCanonCandidateIndexKey, buildTaskCanonicalCandidatesKey } from "./memory-canon-keys.js";
import { getMemory, setMemory } from "./runtime-memory-store.js";

export type MemoryPipelineGuardStatus = "pass" | "fail";

export interface MemoryPipelineSmokeCheck {
  id: string;
  pass: boolean;
  detail?: string;
}

export interface MemoryPipelineSmokeResult {
  memory_pipeline_guard: MemoryPipelineGuardStatus;
  pass: boolean;
  checks: MemoryPipelineSmokeCheck[];
  error?: string;
  timestamp: string;
}

function check(id: string, pass: boolean, detail?: string): MemoryPipelineSmokeCheck {
  return { id, pass, detail };
}

function hasEvidence(type: string): boolean {
  return readEvidenceRecords({ type: type as never, limit: 5 }).length > 0;
}

/**
 * In-process regression gate for the full memory pipeline.
 */
export async function runMemoryPipelineSmoke(): Promise<MemoryPipelineSmokeResult> {
  const timestamp = new Date().toISOString();
  const checks: MemoryPipelineSmokeCheck[] = [];
  let error: string | undefined;

  const evidenceDir = path.join(process.cwd(), ".data", "memory-pipeline-smoke-evidence");
  try {
    if (fs.existsSync(evidenceDir)) {
      fs.rmSync(evidenceDir, { recursive: true, force: true });
    }
    initExecutionEvidenceStore(evidenceDir);

    clearActiveTaskStore();
    clearSession("mpipe_chat");

    const traceMain = `mpipe_main_${Date.now().toString(36)}`;

    let attachment: MemoryAttachment | undefined;
    try {
      attachment = await attachMemoryContext({
        message: "KiloCode patch plan for src/server/index.ts",
        surface: "telegram",
        user_id: "mpipe_user",
        telegram_id: "mpipe_user",
        chat_id: "mpipe_chat",
        trace_id: traceMain,
        role: "creator",
      });
      checks.push(
        check(
          "attach_does_not_fail",
          Boolean(attachment?.user?.user_id && attachment.surface.surface === "telegram"),
        ),
      );
    } catch (e: unknown) {
      checks.push(
        check("attach_does_not_fail", false, e instanceof Error ? e.message : String(e)),
      );
      throw e;
    }

    const retrieval = await retrieveMemoryForPrompt({
      memory_attachment: attachment,
      user_message: "continue patch",
      max_chars: 6000,
    });

    checks.push(check("retrieval_ok", retrieval.ok === true));
    checks.push(
      check(
        "retrieval_within_max_chars",
        retrieval.total_chars <= 6100,
        `chars=${retrieval.total_chars}`,
      ),
    );
    checks.push(
      check(
        "retrieval_selects_task",
        retrieval.selected_items.length === 0 || retrieval.selected_items[0].type === "task",
      ),
    );

    const traceUnknown = `mpipe_unknown_${Date.now().toString(36)}`;
    const attachUnknown = await attachMemoryContext({
      message: "какая погода в Москве?",
      surface: "telegram",
      user_id: "mpipe_user2",
      chat_id: "mpipe_chat_u",
      trace_id: traceUnknown,
    });

    setMemory(
      buildTaskCanonicalCandidatesKey(attachUnknown.task.task_id),
      ["TGR-6.94 — DONE"],
      "canonical",
      true,
    );

    const retrievalUnknown = await retrieveMemoryForPrompt({
      memory_attachment: attachUnknown,
      user_message: "какая погода?",
    });

    const noForeignCanon =
      attachUnknown.project.project === "unknown" &&
      !retrievalUnknown.selected_items.some((i) => i.type === "canonical");
    checks.push(
      check(
        "retrieval_skips_project_canon_when_unknown",
        noForeignCanon,
        `project=${attachUnknown.project.project}`,
      ),
    );

    const writeback = await writebackMemory({
      memory_attachment: attachment,
      user_message: "KiloCode patch plan",
      assistant_response: "TGR-6.97 — DONE. Pipeline baseline STABLE.",
      response_id: `resp_mpipe_${Date.now().toString(36)}`,
      status: "delivered",
      evidence_refs: attachment.evidence_refs,
    });

    checks.push(check("writeback_ok", writeback.stored_items.length > 0));
    checks.push(
      check(
        "writeback_session_excerpt",
        getRecentTurns("mpipe_chat", 3).length >= 2,
        `turns=${getRecentTurns("mpipe_chat", 3).length}`,
      ),
    );
    checks.push(
      check(
        "writeback_canonical_candidate_for_done",
        writeback.canonical_candidates.length >= 1,
      ),
    );

    const canonIndex = getMemory(buildTaskCanonCandidateIndexKey(attachment.task.task_id));
    const autoCanon = getMemory(buildCanonicalDecisionKey(attachment.task.task_id));
    const indexData = (canonIndex?.value as any)?.data;
    checks.push(
      check(
        "writeback_queues_canon_candidates_not_auto_canon",
        Array.isArray(indexData) &&
          indexData.length >= 1 &&
          !autoCanon?.verified,
      ),
    );

    checks.push(check("evidence_memory_context_attached", hasEvidence("memory_context_attached")));
    checks.push(
      check("evidence_memory_retrieval_guard_done", hasEvidence("memory_retrieval_guard_done")),
    );
    checks.push(check("evidence_memory_writeback_done", hasEvidence("memory_writeback_done")));

    const traceEmpty = `mpipe_empty_${Date.now().toString(36)}`;
    const attachEmpty = await attachMemoryContext({
      message: "hi",
      surface: "api",
      user_id: "mpipe_empty",
      trace_id: traceEmpty,
    });

    const emptyAttachment: MemoryAttachment = {
      ...attachEmpty,
      working_context: [],
      short_context: [],
      evidence_refs: attachEmpty.evidence_refs.slice(0, 1),
      canonical_keys: [],
    };

    const retrievalEmpty = await retrieveMemoryForPrompt({
      memory_attachment: emptyAttachment,
      user_message: "hi",
    });

    const writebackEmpty = await writebackMemory({
      memory_attachment: emptyAttachment,
      user_message: "hi",
      assistant_response: "hello",
      response_id: "resp_empty",
      status: "delivered",
    });

    checks.push(
      check(
        "pipeline_empty_store",
        retrievalEmpty.ok && writebackEmpty.stored_items.length > 0,
      ),
    );
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
    if (!checks.some((c) => c.id === "attach_does_not_fail")) {
      checks.push(check("pipeline_execution", false, error));
    }
  }

  const pass = checks.length > 0 && checks.every((c) => c.pass) && !error;

  return {
    memory_pipeline_guard: pass ? "pass" : "fail",
    pass,
    checks,
    error,
    timestamp,
  };
}

/** Alias for prewave / ops */
export const runMemoryPipelineGuard = runMemoryPipelineSmoke;
