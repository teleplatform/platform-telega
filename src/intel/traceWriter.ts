// @ts-nocheck
import fs from "fs";
import path from "path";

function traceDir(telegaRoot: string) {
  return path.join(telegaRoot, "mission-control", "buildtasks", "traces");
}

function ensureDir(telegaRoot: string) {
  fs.mkdirSync(traceDir(telegaRoot), { recursive: true });
}

function tracePath(telegaRoot: string, traceId: string) {
  return path.join(traceDir(telegaRoot), `${traceId}.jsonl`);
}

function appendLine(file: string, obj: any) {
  const line = JSON.stringify(obj) + "\n";
  fs.appendFileSync(file, line, "utf8");
}

export function traceStart(telegaRoot: string, traceId: string, evt: any) {
  ensureDir(telegaRoot);
  appendLine(tracePath(telegaRoot, traceId), { ...evt, trace_id: traceId, _t: Date.now() });
}

export function traceEvent(telegaRoot: string, traceId: string, evt: any) {
  ensureDir(telegaRoot);
  appendLine(tracePath(telegaRoot, traceId), { ...evt, trace_id: traceId, _t: Date.now() });
}

export function traceEnd(telegaRoot: string, traceId: string, evt: any) {
  ensureDir(telegaRoot);
  appendLine(tracePath(telegaRoot, traceId), { ...evt, trace_id: traceId, _t: Date.now() });
}

export function traceExists(telegaRoot: string, traceId: string) {
  return fs.existsSync(tracePath(telegaRoot, traceId));
}

export function getTraceFile(telegaRoot: string, traceId: string) {
  return tracePath(telegaRoot, traceId);
}
