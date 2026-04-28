import { getHealthSummary } from "../delivery/delivery-summary.js";
import { getRecentErrors, getRecentEvidence } from "../delivery/delivery-evidence.store.js";
import type { DegradationClass, DegradationSignal } from "./decision-engine.types.js";

const EVIDENCE_WINDOW_MS = 120000; // 2 minutes
const MIN_ERRORS_FOR_SPIKE = 3;
const MIN_BLOCKED_FOR_SPIKE = 5;
const BRIDGE_STALE_THRESHOLD_MS = 90000; // 90s no success

export function classifyDegradation(): DegradationSignal {
  const now = Date.now();
  const windowMs = EVIDENCE_WINDOW_MS;
  const summary = getHealthSummary(100);
  const recentEvidence = getRecentEvidence(100);
  const recentErrors = getRecentErrors(10);

  // Filter to window
  const windowEvidence = recentEvidence.filter(e => now - e.createdAt < windowMs);
  const windowErrors = recentErrors.filter(e => now - e.createdAt < windowMs);

  const successCount = windowEvidence.filter(e => e.status === "success").length;
  const blockedCount = windowEvidence.filter(e => e.status === "blocked").length;
  const errorCount = windowEvidence.filter(e => e.status === "error").length;
  const totalRelevant = successCount + blockedCount + errorCount;

  // Calculate last success timestamp
  const lastSuccess = windowEvidence
    .filter(e => e.status === "success")
    .sort((a, b) => b.createdAt - a.createdAt)[0]?.createdAt || 0;

  // Check for no activity at all (bot may be dead)
  const lastActivity = windowEvidence.length > 0
    ? Math.max(...windowEvidence.map(e => e.createdAt))
    : 0;
  const silenceMs = now - lastActivity;

  // Degradation 1: BRIDGE_STALE — no successful deliveries for too long
  if (successCount === 0 && totalRelevant > 0) {
    const staleMs = lastSuccess > 0 ? now - lastSuccess : silenceMs;
    if (staleMs > BRIDGE_STALE_THRESHOLD_MS) {
      return {
        class: "BRIDGE_STALE",
        severity: 70,
        reason: `No successful deliveries for ${Math.round(staleMs / 1000)}s (${totalRelevant} attempts without success)`,
        evidence: windowEvidence.map(e => `[${e.status}] ${e.provider}`),
        windowMs,
      };
    }
  }

  // Degradation 2: CDP_UNAVAILABLE — provider errors for CDP/API providers
  const cdpErrors = windowErrors.filter(e =>
    e.provider.includes("cdp") || e.provider.includes("openai") || e.reason?.includes("provider")
  );
  if (cdpErrors.length >= MIN_ERRORS_FOR_SPIKE) {
    return {
      class: "CDP_UNAVAILABLE",
      severity: 85,
      reason: `${cdpErrors.length} provider/CDP failures in ${windowMs / 1000}s`,
      evidence: cdpErrors.map(e => `${e.provider}: ${e.reason}`),
      windowMs,
    };
  }

  // Degradation 3: EMPTY_OUTPUT_SPIKE — model returning empty/short outputs
  const blockedSpike = windowEvidence.filter(e => e.status === "blocked");
  if (blockedSpike.length >= MIN_BLOCKED_FOR_SPIKE) {
    const reasons = blockedSpike.map(e => e.reason).filter(Boolean);
    const uniqueReasons = [...new Set(reasons)];
    return {
      class: "EMPTY_OUTPUT_SPIKE",
      severity: 65,
      reason: `${blockedSpike.length} blocked outputs (${uniqueReasons.join(", ")})`,
      evidence: blockedSpike.map(e => e.reason || "blocked"),
      windowMs,
    };
  }

  // Degradation 4: ECHO_REPLY_SPIKE — model echoing user input
  const echoBlocks = windowEvidence.filter(e =>
    e.status === "blocked" && e.reason?.includes("echo")
  );
  if (echoBlocks.length >= 2) {
    return {
      class: "ECHO_REPLY_SPIKE",
      severity: 60,
      reason: `${echoBlocks.length} echo detections — model mirroring user`,
      evidence: echoBlocks.map(e => `chat ${e.chatId}: echo`),
      windowMs,
    };
  }

  // Degradation 5: DELIVERY_ERROR_SPIKE — delivery layer failing
  const deliveryErrors = windowErrors.filter(e =>
    e.reason?.includes("delivery") || e.reason?.includes("send") || e.reason?.includes("telegram")
  );
  if (deliveryErrors.length >= MIN_ERRORS_FOR_SPIKE) {
    return {
      class: "DELIVERY_ERROR_SPIKE",
      severity: 80,
      reason: `${deliveryErrors.length} delivery failures in ${windowMs / 1000}s`,
      evidence: deliveryErrors.map(e => e.reason).filter((x): x is string => typeof x === "string"),
      windowMs,
    };
  }

  // Degradation 6: BOT_ALIVE_BUT_NO_SUCCESS — bot responsive but no real output
  if (totalRelevant > 0 && successCount === 0 && errorCount === 0 && blockedCount > 0) {
    return {
      class: "BOT_ALIVE_BUT_NO_SUCCESS",
      severity: 55,
      reason: `Bot alive but all ${blockedCount} outputs blocked (possibly bad prompt/context)`,
      evidence: windowEvidence.map(e => `blocked: ${e.reason || "unknown"}`),
      windowMs,
    };
  }

  // Degradation 7: WATCHDOG_LOOP_RISK — too many recoveries recently
  // This is checked via receipts separately, but signal here
  // (will be combined with receipt check in decision engine)

  // Default: HEALTHY
  return {
    class: "HEALTHY",
    severity: 0,
    reason: `OK: ${successCount}/${totalRelevant} successful (${errorCount} err, ${blockedCount} blocked)`,
    evidence: [],
    windowMs,
  };
}

export function isHealthy(signal: DegradationSignal): boolean {
  return signal.class === "HEALTHY";
}

export function getDegradationSeverity(signal: DegradationSignal): "low" | "medium" | "high" | "critical" {
  if (signal.class === "HEALTHY") return "low";
  if (signal.severity >= 80) return "critical";
  if (signal.severity >= 60) return "high";
  if (signal.severity >= 40) return "medium";
  return "low";
}
