// @ts-nocheck
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { TelecoreBuildTaskV1 } from "./buildTaskTypes";
import { ensureBuildTaskDirs, getBuildTaskPaths } from "./buildTaskStore";

function id12(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
}

function packToPathHint(pack: string) {
  return `docs/packs/${String(pack).replace(/\s+/g, "_")}_v1.md`;
}

export function writeBuildTaskFromPackCandidate(opts: {
  telegaRoot: string;
  digestId: string;
  pack: string;
  evidence?: { intel_ids?: string[]; notes?: string[]; links?: string[] };
}) {
  const telegaRoot = opts.telegaRoot;
  const p = ensureBuildTaskDirs(telegaRoot);

  const taskId = `bt_${new Date().toISOString().slice(0, 10)}_${id12(
    opts.digestId + "|" + opts.pack
  )}`;

  const task: TelecoreBuildTaskV1 = {
    kind: "TELECORE_BUILD_TASK_V1",
    id: taskId,
    created_at: new Date().toISOString(),
    source: "pantheon",
    status: "queued",
    intent: { type: "PACK_CANDIDATE", pack: opts.pack },
    context: {
      digest_id: opts.digestId,
      evidence: opts.evidence || {},
    },
    deliverable: {
      format: "patch_pack",
      target_repo: "tele-ga",
      target_path_hint: packToPathHint(opts.pack),
    },
  };

  const file = `${taskId}.json`;
  fs.writeFileSync(path.join(p.outbox, file), JSON.stringify(task, null, 2), "utf8");
  return { taskId, file };
}

export function writeManualBuildTask(opts: {
  telegaRoot: string;
  pack: string;
  evidence?: { notes?: string[]; links?: string[] };
}) {
  const telegaRoot = opts.telegaRoot;
  ensureBuildTaskDirs(telegaRoot);

  const digestId = `manual_${new Date().toISOString().slice(0, 10)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const taskId = `bt_${new Date().toISOString().slice(0, 10)}_${id12(
    digestId + "|" + opts.pack
  )}`;

  const task: TelecoreBuildTaskV1 = {
    kind: "TELECORE_BUILD_TASK_V1",
    id: taskId,
    created_at: new Date().toISOString(),
    source: "pantheon",
    status: "queued",
    intent: { type: "MANUAL_PACK", pack: opts.pack },
    context: {
      digest_id: digestId,
      evidence: { notes: opts.evidence?.notes || [], links: opts.evidence?.links || [] },
    },
    deliverable: {
      format: "patch_pack",
      target_repo: "tele-ga",
      target_path_hint: packToPathHint(opts.pack),
    },
  };

  const p = getBuildTaskPaths(telegaRoot);
  const file = `${taskId}.json`;
  fs.writeFileSync(path.join(p.outbox, file), JSON.stringify(task, null, 2), "utf8");
  return { taskId, file, digestId };
}
