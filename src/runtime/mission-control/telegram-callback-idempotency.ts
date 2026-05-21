import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface TelegramCallbackFingerprint {
  fingerprint: string;
  callback_data: string;
  actor_id?: string;
  message_id?: string | number;
  created_at: string;
}

const CALLBACKS_DIR = path.join(process.cwd(), ".data", "execution-evidence");
const CALLBACKS_FILE = "telegram-callbacks.jsonl";
const CALLBACKS_PATH = path.join(CALLBACKS_DIR, CALLBACKS_FILE);

const FINGERPRINT_TTL_MS = 30 * 60 * 1000;

function ensureDir(): void {
  if (!fs.existsSync(CALLBACKS_DIR)) {
    fs.mkdirSync(CALLBACKS_DIR, { recursive: true });
  }
}

function readAllFingerprints(): TelegramCallbackFingerprint[] {
  if (!fs.existsSync(CALLBACKS_PATH)) return [];
  const content = fs.readFileSync(CALLBACKS_PATH, { encoding: "utf8" });
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as TelegramCallbackFingerprint;
      } catch {
        return null;
      }
    })
    .filter((r): r is TelegramCallbackFingerprint => r !== null);
}

function writeAllFingerprints(fps: TelegramCallbackFingerprint[]): void {
  ensureDir();
  const lines = fps.map((f) => JSON.stringify(f)).join("\n") + "\n";
  fs.writeFileSync(CALLBACKS_PATH, lines, { encoding: "utf8" });
}

export function computeCallbackFingerprint(
  callback_data: string,
  actor_id?: string,
  message_id?: string | number,
): string {
  const raw = `${callback_data}:${actor_id || ""}:${message_id ?? ""}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function isDuplicateCallback(fingerprint: string): boolean {
  expireOldFingerprints();
  return readAllFingerprints().some((f) => f.fingerprint === fingerprint);
}

export function storeCallbackFingerprint(fp: TelegramCallbackFingerprint): void {
  ensureDir();
  const records = readAllFingerprints();
  records.push(fp);
  writeAllFingerprints(records);
}

export function expireOldFingerprints(): number {
  const records = readAllFingerprints();
  const now = Date.now();
  const before = records.length;
  const kept = records.filter(
    (f) => new Date(f.created_at).getTime() > now - FINGERPRINT_TTL_MS,
  );
  if (kept.length < before) {
    writeAllFingerprints(kept);
  }
  return before - kept.length;
}

export async function checkCallbackReplayProtection(payload: {
  callback_data: string;
  actor_id?: string;
  actor_username?: string;
  message_id?: string | number;
  approval_id?: string;
  action?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  fingerprint?: string;
  traceId?: string;
}> {
  const fingerprint = computeCallbackFingerprint(
    payload.callback_data,
    payload.actor_id,
    payload.message_id,
  );

  if (isDuplicateCallback(fingerprint)) {
    const traceId = `dup_${fingerprint.slice(0, 12)}`;
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "telegram_callback_duplicate_detected"),
      trace_id: traceId,
      job_id: "idempotency",
      type: "telegram_callback_duplicate_detected",
      timestamp: new Date().toISOString(),
      payload: {
        fingerprint,
        callback_data: payload.callback_data,
        actor_id: payload.actor_id,
        message_id: payload.message_id,
        approval_id: payload.approval_id,
        action: payload.action,
      },
    });
    return { ok: false, error: "duplicate callback", fingerprint, traceId };
  }

  storeCallbackFingerprint({
    fingerprint,
    callback_data: payload.callback_data,
    actor_id: payload.actor_id,
    message_id: payload.message_id,
    created_at: new Date().toISOString(),
  });

  return { ok: true, fingerprint };
}
