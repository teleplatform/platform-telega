import fs from "node:fs";
import path from "node:path";
import { getEvidenceByType } from "./execution-evidence-store.js";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";

const ATTEMPTS_DIR = path.join(process.cwd(), ".data", "execution-evidence");
const ATTEMPTS_FILE = "replay-attempts.jsonl";
const ATTEMPTS_PATH = path.join(ATTEMPTS_DIR, ATTEMPTS_FILE);

const ONE_HOUR_MS = 3600_000;
const ONE_DAY_MS = 86_400_000;

interface ReplayAttemptRecord {
  trace_id: string;
  force: boolean;
  timestamp: string;
  expires_at: number;
}

export interface ReplayRateLimitInput {
  trace_id: string;
  force?: boolean;
}

export interface ReplayRateLimitResult {
  allowed: boolean;
  reason?: string;
  limits: {
    per_trace: { current: number; max: number };
    per_hour: { current: number; max: number };
    force_per_day: { current: number; max: number };
  };
}

function getMaxPerTrace(): number {
  return Math.max(1, Number(process.env.REPLAY_MAX_PER_TRACE) || 3);
}

function getMaxPerHour(): number {
  return Math.max(1, Number(process.env.REPLAY_MAX_PER_HOUR) || 20);
}

function getMaxForcePerDay(): number {
  return Math.max(0, Number(process.env.REPLAY_MAX_FORCE_PER_DAY) || 5);
}

function readAttempts(): ReplayAttemptRecord[] {
  if (!fs.existsSync(ATTEMPTS_PATH)) return [];
  const content = fs.readFileSync(ATTEMPTS_PATH, { encoding: "utf8" });
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as ReplayAttemptRecord;
      } catch {
        return null;
      }
    })
    .filter((r): r is ReplayAttemptRecord => r !== null);
}

function writeAttempts(records: ReplayAttemptRecord[]): void {
  if (!fs.existsSync(ATTEMPTS_DIR)) {
    fs.mkdirSync(ATTEMPTS_DIR, { recursive: true });
  }
  const now = Date.now();
  const active = records.filter((r) => r.expires_at > now);
  const lines = active.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(ATTEMPTS_PATH, lines, { encoding: "utf8" });
}

function recordAttempt(traceId: string, force: boolean): void {
  const records = readAttempts();
  records.push({
    trace_id: traceId,
    force,
    timestamp: new Date().toISOString(),
    expires_at: Date.now() + (force ? ONE_DAY_MS : ONE_HOUR_MS),
  });
  writeAttempts(records);
}

export async function checkReplayRateLimit(
  input: ReplayRateLimitInput,
): Promise<ReplayRateLimitResult> {
  const maxPerTrace = getMaxPerTrace();
  const maxPerHour = getMaxPerHour();
  const maxForcePerDay = getMaxForcePerDay();

  const now = Date.now();

  const allReplays = readAttempts();
  const activeReplays = allReplays.filter((r) => r.expires_at > now);

  const perTrace = activeReplays.filter((r) => r.trace_id === input.trace_id).length;

  const perHour = activeReplays.length;

  const forcePerDay = activeReplays.filter((r) => r.force).length;

  const traceReplayCount = getEvidenceByType("replay_started").filter(
    (r) => r.parent_trace_id === input.trace_id,
  ).length;
  const effectivePerTrace = Math.max(traceReplayCount, perTrace);

  const limits = {
    per_trace: { current: effectivePerTrace, max: maxPerTrace },
    per_hour: { current: perHour, max: maxPerHour },
    force_per_day: { current: forcePerDay, max: maxForcePerDay },
  };

  let deniedReason: string | undefined;

  if (effectivePerTrace >= maxPerTrace) {
    deniedReason = `per_trace_limit: ${effectivePerTrace}/${maxPerTrace} replays for trace ${input.trace_id}`;
  } else if (perHour >= maxPerHour) {
    deniedReason = `per_hour_limit: ${perHour}/${maxPerHour} replays in the last hour`;
  } else if (input.force && forcePerDay >= maxForcePerDay) {
    deniedReason = `force_per_day_limit: ${forcePerDay}/${maxForcePerDay} force replays today`;
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id, "replay_rate_limit_checked"),
    trace_id: input.trace_id,
    job_id: input.trace_id,
    type: deniedReason ? "replay_rate_limit_exceeded" : "replay_rate_limit_checked",
    timestamp: new Date().toISOString(),
    payload: {
      trace_id: input.trace_id,
      allowed: !deniedReason,
      reason: deniedReason,
      per_trace: effectivePerTrace,
      per_trace_max: maxPerTrace,
      per_hour: perHour,
      per_hour_max: maxPerHour,
      force_per_day: forcePerDay,
      force_per_day_max: maxForcePerDay,
      force: !!input.force,
    },
  });

  return { allowed: !deniedReason, reason: deniedReason, limits };
}

export async function recordReplayAttempt(input: ReplayRateLimitInput): Promise<void> {
  recordAttempt(input.trace_id, !!input.force);
}

export function getReplayRateLimitStatus() {
  const attempts = readAttempts();
  const now = Date.now();
  const active = attempts.filter((r) => r.expires_at > now);
  return {
    max_per_trace: getMaxPerTrace(),
    max_per_hour: getMaxPerHour(),
    max_force_per_day: getMaxForcePerDay(),
    active_attempts: active.length,
    current_hour_usage: active.length,
  };
}
