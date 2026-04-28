// @ts-nocheck
import fs from "fs";
import path from "path";
import type { TelecoreBuildTaskV1 } from "./buildTaskTypes";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function getBuildTaskPaths(telegaRoot: string) {
  const root = path.join(telegaRoot, "mission-control", "buildtasks");
  const outbox = path.join(root, "outbox");
  const inbox = path.join(root, "inbox");
  const done = path.join(root, "done");
  const failed = path.join(root, "failed");
  return { root, outbox, inbox, done, failed };
}

export function ensureBuildTaskDirs(telegaRoot: string) {
  const p = getBuildTaskPaths(telegaRoot);
  ensureDir(p.outbox);
  ensureDir(p.inbox);
  ensureDir(p.done);
  ensureDir(p.failed);
  return p;
}

function listJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
}

export function listBuildTasks(
  telegaRoot: string,
  box: "outbox" | "inbox" | "done" | "failed",
  take = 10
) {
  const p = ensureBuildTaskDirs(telegaRoot);
  const dir = p[box];
  return listJson(dir).slice(0, Math.max(1, take));
}

export function readBuildTask(
  telegaRoot: string,
  box: "outbox" | "inbox" | "done" | "failed",
  file: string
) {
  const p = ensureBuildTaskDirs(telegaRoot);
  const full = path.join(p[box], file);
  const raw = fs.readFileSync(full, "utf8");
  return JSON.parse(raw) as TelecoreBuildTaskV1;
}

export function countBuildTasks(telegaRoot: string) {
  const p = ensureBuildTaskDirs(telegaRoot);
  return {
    outbox: listJson(p.outbox).length,
    inbox: listJson(p.inbox).length,
    done: listJson(p.done).length,
    failed: listJson(p.failed).length,
  };
}

export function findTaskFile(telegaRoot: string, taskId: string) {
  const p = ensureBuildTaskDirs(telegaRoot);
  const boxes: Array<keyof typeof p> = ["outbox", "inbox", "done", "failed"];
  for (const box of boxes) {
    const dir = p[box];
    if (!fs.existsSync(dir)) continue;
    const file = `${taskId}.json`;
    const full = path.join(dir, file);
    if (fs.existsSync(full)) return { box: box as any, file, full };
  }
  return null;
}

export function readBuildTaskById(telegaRoot: string, taskId: string) {
  const hit = findTaskFile(telegaRoot, taskId);
  if (!hit) return null;
  const raw = fs.readFileSync(hit.full, "utf8");
  return JSON.parse(raw) as TelecoreBuildTaskV1;
}

export function moveTask(
  telegaRoot: string,
  fromBox: "outbox" | "inbox" | "done" | "failed",
  toBox: "outbox" | "inbox" | "done" | "failed",
  file: string
) {
  const p = ensureBuildTaskDirs(telegaRoot);
  const from = path.join(p[fromBox], file);
  const to = path.join(p[toBox], file);
  fs.renameSync(from, to);
  return { from, to };
}
