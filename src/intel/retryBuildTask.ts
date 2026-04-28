// @ts-nocheck
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { TelecoreBuildTaskV1 } from "./buildTaskTypes";
import { ensureBuildTaskDirs, getBuildTaskPaths, readBuildTaskById } from "./buildTaskStore";

function id12(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
}

export function retryBuildTask(telegaRoot: string, sourceTaskId: string, oldTraceId: string) {
  const src = readBuildTaskById(telegaRoot, sourceTaskId);
  if (!src) throw new Error("source task not found");

  const taskId = `bt_${new Date().toISOString().slice(0, 10)}_${id12(
    `${sourceTaskId}|${Date.now()}`
  )}`;

  const newTask: TelecoreBuildTaskV1 = {
    ...src,
    id: taskId,
    created_at: new Date().toISOString(),
    status: "queued",
    meta: {
      ...(src.meta || {}),
      retry_of_task: sourceTaskId,
      retry_of_trace: oldTraceId,
    },
  };

  ensureBuildTaskDirs(telegaRoot);
  const p = getBuildTaskPaths(telegaRoot);
  const file = `${taskId}.json`;
  fs.writeFileSync(path.join(p.outbox, file), JSON.stringify(newTask, null, 2), "utf8");
  return { task: newTask, file };
}
