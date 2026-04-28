// @ts-nocheck
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { TelecoreBuildTaskV1 } from "./buildTaskTypes";
import type { TelecoreBuildResultV1 } from "./buildResultTypes";
import {
  ensureBuildTaskDirs,
  listBuildTasks,
  moveTask,
  readBuildTask,
} from "./buildTaskStore";
import { generatePackSpecMarkdown } from "./packSpecGenerator";
import { validatePackSpecFile } from "./packSpecValidator";
import { appendBuildResultIndex } from "./buildResultIndex";
import { traceStart, traceEvent, traceEnd } from "./traceWriter";

function id12(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
}

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as T;
}

function writeJson(file: string, data: any) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function writeBuildResult(
  telegaRoot: string,
  task: TelecoreBuildTaskV1,
  traceId: string,
  status: "done" | "failed",
  payload: {
    summary: string[];
    artifacts: Array<{ type: "markdown" | "json" | "log" | "patch"; path: string; note?: string }>;
    logs: string[];
    error?: { message: string; stack?: string };
  }
) {
  const p = ensureBuildTaskDirs(telegaRoot);
  const brId = `br_${new Date().toISOString().slice(0, 10)}_${id12(task.id)}`;
  const result: TelecoreBuildResultV1 = {
    kind: "TELECORE_BUILD_RESULT_V1",
    id: brId,
    task_id: task.id,
    trace_id: traceId,
    created_at: new Date().toISOString(),
    status,
    summary: payload.summary,
    artifacts: payload.artifacts,
    logs: { lines: payload.logs },
    error: payload.error,
  };
  const file = `${brId}.json`;
  const out = path.join(p.inbox, file);
  writeJson(out, result);
  return { brId, file, out };
}

function updateTaskStatusFile(
  telegaRoot: string,
  box: "outbox" | "done" | "failed",
  file: string,
  patch: Partial<TelecoreBuildTaskV1>
) {
  const p = ensureBuildTaskDirs(telegaRoot);
  const full = path.join(p[box], file);
  const cur = readJson<TelecoreBuildTaskV1>(full);
  const next = { ...cur, ...patch };
  writeJson(full, next);
  return next;
}

export function runOneBuildTask(opts: { telegaRoot: string }) {
  const telegaRoot = opts.telegaRoot;
  ensureBuildTaskDirs(telegaRoot);

  const files = listBuildTasks(telegaRoot, "outbox", 50).reverse();
  if (files.length === 0) {
    return { ok: true as const, kind: "EMPTY" as const };
  }

  const file = files[0];
  const task = readBuildTask(telegaRoot, "outbox", file);
  const traceId = crypto.randomUUID();

  updateTaskStatusFile(telegaRoot, "outbox", file, { status: "running" });

  const logs: string[] = [];
  logs.push(`[worker] picked task ${task.id} (${task.intent.pack})`);
  logs.push(`[worker] status=running`);
  const retryOf = task.meta?.retry_of_trace;
  const startEvt: any = {
    kind: "build.start",
    task_id: task.id,
    pack: task.intent.pack,
  };
  if (retryOf) startEvt.retry_of = retryOf;
  traceStart(telegaRoot, traceId, startEvt);
  const t0 = Date.now();

  try {
    traceEvent(telegaRoot, traceId, { kind: "stage", name: "pack_spec.generate", at: Date.now() });
    const spec = generatePackSpecMarkdown({ telegaRoot, task, mode: "target_repo" });
    logs.push(`[worker] pack spec written: ${spec.outRel}`);

    traceEvent(telegaRoot, traceId, { kind: "stage", name: "pack_spec.validate", at: Date.now() });
    const v = validatePackSpecFile(spec.outAbs);
    if (!v.ok) {
      throw new Error(v.error);
    }
    logs.push(`[worker] pack spec validated OK`);

    traceEvent(telegaRoot, traceId, { kind: "stage", name: "build_result.write", at: Date.now() });
    const res = writeBuildResult(telegaRoot, task, traceId, "done", {
      summary: [
        `Generated REAL pack spec for \"${task.intent.pack}\"`,
        `Path: ${spec.outRel}`,
        `Validated: OK`,
      ],
      artifacts: [{ type: "markdown", path: spec.outRel, note: "Pack spec (strict template)" }],
      logs,
    });
    traceEvent(telegaRoot, traceId, { kind: "stage", name: "index.append", at: Date.now() });
    appendBuildResultIndex(telegaRoot, {
      id: res.brId,
      task_id: task.id,
      trace_id: traceId,
      created_at: new Date().toISOString(),
      status: "done",
      pack: task.intent.pack,
      artifacts: [{ type: "markdown", path: spec.outRel, note: "Pack spec (strict template)" }],
    });
    logs.push(`[worker] result index updated`);

    moveTask(telegaRoot, "outbox", "done", file);
    updateTaskStatusFile(telegaRoot, "done", file, { status: "done" });
    traceEnd(telegaRoot, traceId, { kind: "build.done", ok: true, ms: Date.now() - t0 });

    return {
      ok: true as const,
      kind: "DONE" as const,
      taskFile: file,
      taskId: task.id,
      resultFile: res.file,
      traceId,
    };
  } catch (e: any) {
    const msg = e?.message || String(e);
    const stack = e?.stack ? String(e.stack) : undefined;
    logs.push(`[worker] ERROR: ${msg}`);
    traceEvent(telegaRoot, traceId, {
      kind: "error",
      at: Date.now(),
      message: msg,
      stack: stack || "",
    });

    const res = writeBuildResult(telegaRoot, task, traceId, "failed", {
      summary: [`Task failed for \"${task.intent.pack}\"`],
      artifacts: [],
      logs,
      error: { message: msg, stack },
    });
    appendBuildResultIndex(telegaRoot, {
      id: res.brId,
      task_id: task.id,
      trace_id: traceId,
      created_at: new Date().toISOString(),
      status: "failed",
      pack: task.intent.pack,
      artifacts: [],
      error: { message: msg },
    });
    logs.push(`[worker] result index updated`);

    moveTask(telegaRoot, "outbox", "failed", file);
    updateTaskStatusFile(telegaRoot, "failed", file, { status: "failed" });
    traceEnd(telegaRoot, traceId, { kind: "build.done", ok: false, ms: Date.now() - t0 });

    return {
      ok: false as const,
      kind: "FAILED" as const,
      taskFile: file,
      taskId: task.id,
      resultFile: res.file,
      error: msg,
      traceId,
    };
  }
}
