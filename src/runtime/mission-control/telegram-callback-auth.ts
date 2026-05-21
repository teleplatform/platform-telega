import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface TelegramCallbackAuthResult {
  allowed: boolean;
  reason?: string;
  actor_id?: string;
  actor_username?: string;
}

function loadAllowlist(): { actorIds: string[]; usernames: string[] } {
  const rawIds = process.env.TELEGRAM_MISSION_CONTROL_ALLOWED_ACTORS || "";
  const rawUsernames = process.env.TELEGRAM_MISSION_CONTROL_ALLOWED_USERNAMES || "";
  return {
    actorIds: rawIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    usernames: rawUsernames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function authorizeTelegramCallback(payload: {
  actor_id?: string;
  actor_username?: string;
}): Promise<TelegramCallbackAuthResult> {
  const { actorIds, usernames } = loadAllowlist();
  const isProd = isProduction();
  const traceId = `auth_${payload.actor_id || payload.actor_username || "unknown"}_${Date.now()}`;

  if (isProd && actorIds.length === 0 && usernames.length === 0) {
    const result: TelegramCallbackAuthResult = {
      allowed: false,
      reason: "production: allowlist is empty, all callbacks denied",
      actor_id: payload.actor_id,
      actor_username: payload.actor_username,
    };
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "telegram_callback_denied"),
      trace_id: traceId,
      job_id: "auth",
      type: "telegram_callback_denied",
      timestamp: new Date().toISOString(),
      payload: { ...result },
    });
    return result;
  }

  if (actorIds.length === 0 && usernames.length === 0) {
    const result: TelegramCallbackAuthResult = {
      allowed: true,
      reason: "dev: allowlist empty, non-production — allowing",
      actor_id: payload.actor_id,
      actor_username: payload.actor_username,
    };
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "telegram_callback_authorized"),
      trace_id: traceId,
      job_id: "auth",
      type: "telegram_callback_authorized",
      timestamp: new Date().toISOString(),
      payload: { ...result },
    });
    return result;
  }

  if (payload.actor_id && actorIds.includes(String(payload.actor_id))) {
    const result: TelegramCallbackAuthResult = {
      allowed: true,
      reason: "actor_id matched allowlist",
      actor_id: payload.actor_id,
      actor_username: payload.actor_username,
    };
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "telegram_callback_authorized"),
      trace_id: traceId,
      job_id: "auth",
      type: "telegram_callback_authorized",
      timestamp: new Date().toISOString(),
      payload: { ...result },
    });
    return result;
  }

  if (
    payload.actor_username &&
    usernames.some((u) => u.toLowerCase() === payload.actor_username!.toLowerCase())
  ) {
    const result: TelegramCallbackAuthResult = {
      allowed: true,
      reason: "actor_username matched allowlist",
      actor_id: payload.actor_id,
      actor_username: payload.actor_username,
    };
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "telegram_callback_authorized"),
      trace_id: traceId,
      job_id: "auth",
      type: "telegram_callback_authorized",
      timestamp: new Date().toISOString(),
      payload: { ...result },
    });
    return result;
  }

  const result: TelegramCallbackAuthResult = {
    allowed: false,
    reason: `actor not in allowlist: id=${payload.actor_id || "none"} username=${payload.actor_username || "none"}`,
    actor_id: payload.actor_id,
    actor_username: payload.actor_username,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "telegram_callback_denied"),
    trace_id: traceId,
    job_id: "auth",
    type: "telegram_callback_denied",
    timestamp: new Date().toISOString(),
    payload: { ...result },
  });
  return result;
}
