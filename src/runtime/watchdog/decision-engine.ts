import { classifyDegradation, isHealthy } from "./degradation-classifier.js";
import {
  executeAction,
  isLockStateActive,
  clearLockState,
} from "./recovery-actions.js";
import {
  writeReceipt,
  getRecoveryCountInWindow,
  getLastReceipt,
  getRecentReceipts,
} from "./decision-receipts.js";
import type {
  DegradationSignal,
  RecoveryDecision,
  DecisionReceipt,
  RecoveryAction,
  ActionPrecedence,
  RecoveryPolicy,
} from "./decision-engine.types.js";
import { DEFAULT_RECOVERY_POLICY, ACTION_COOLDOWN } from "./decision-engine.types.js";
import { getState } from "../watchdog/watchdog.state.js";

const POLICY = DEFAULT_RECOVERY_POLICY;

// Mapping degradation class → prioritized recovery actions
const DEGRADATION_ACTION_MAP: Record<string, RecoveryAction[]> = {
  HEALTHY: ["NO_OP"],
  BRIDGE_STALE: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER", "RESTART_BOT_SERVICE"],
  CDP_UNAVAILABLE: ["RECONNECT_CDP", "RESTART_BRIDGE_LAYER", "RESTART_BOT_SERVICE"],
  EMPTY_OUTPUT_SPIKE: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER"],
  ECHO_REPLY_SPIKE: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER"],
  DELIVERY_ERROR_SPIKE: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER", "RESTART_BOT_SERVICE"],
  BOT_ALIVE_BUT_NO_SUCCESS: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER"],
  WATCHDOG_LOOP_RISK: ["ENTER_LOCK_STATE"],
};

// Precedence for each action
const ACTION_PRECEDENCE: Record<RecoveryAction, ActionPrecedence> = {
  NO_OP: "low",
  RESET_BRIDGE_STATE: "medium",
  RECONNECT_CDP: "medium",
  RESTART_BRIDGE_LAYER: "high",
  RESTART_BOT_SERVICE: "critical",
  ENTER_LOCK_STATE: "critical",
  REQUIRE_OPERATOR_RESET: "critical",
};

function makeReason(degradation: DegradationSignal, action: RecoveryAction, escalate: boolean): string {
  const base = degradation.reason;
  if (escalate) {
    return `${base} → escalated to ${action}`;
  }
  return `${base} → ${action}`;
}

function isInCooldown(action: RecoveryAction): boolean {
  const last = getLastReceipt();
  if (!last || last.selectedAction === "NO_OP") return false;

  const now = Date.now();
  const cooldown = ACTION_COOLDOWN[action];
  if (cooldown === 0) return false;

  const elapsed = now - last.timestamp;
  return elapsed < cooldown;
}

function getRecoveryCount(windowMs: number): number {
  return getRecoveryCountInWindow(windowMs);
}

function shouldEscalate(recoveryCount: number): boolean {
  return recoveryCount >= POLICY.maxRecoveriesPerWindow;
}

function selectAction(degradation: DegradationSignal, escalate: boolean): RecoveryAction {
  const candidates = DEGRADATION_ACTION_MAP[degradation.class] || ["NO_OP"];
  if (candidates.includes("ENTER_LOCK_STATE" as any)) {
    return "ENTER_LOCK_STATE";
  }
  // For escalate=true, pick last (most aggressive)
  if (escalate && candidates.length > 1) {
    return candidates[candidates.length - 1];
  }
  // Default: first (least aggressive)
  return candidates[0];
}

function makeConfidence(degradation: DegradationSignal, action: RecoveryAction): number {
  // Higher severity → higher confidence in recovery need
  // Certain actions (ENTER_LOCK_STATE) get max confidence
  if (action === "ENTER_LOCK_STATE") return 99;
  if (action === "RESTART_BOT_SERVICE") return 95;
  if (action === "RESTART_BRIDGE_LAYER") return 85;
  if (action === "RECONNECT_CDP") return 75;
  return 70 + degradation.severity;
}

export function makeDecision(
  currentState: {
    consecutiveFailures: number;
    lastRecovery: number;
    isDegraded: boolean;
    lockState: boolean;
    recoveryCount: number;
  }
): RecoveryDecision | null {
  // 1. Classify degradation
  const degradation = classifyDegradation();

  // 2. If healthy → NO_OP
  if (isHealthy(degradation)) {
    return {
      action: "NO_OP",
      precedence: "low",
      reason: degradation.reason,
      cooldownApplied: false,
      cooldownMs: 0,
      lockState: false,
      receiptId: "",
      confidence: 100,
    };
  }

  // 3. Check if already in lock state
  if (isLockStateActive() || currentState.lockState) {
    return {
      action: "REQUIRE_OPERATOR_RESET",
      precedence: "critical",
      reason: "System in lock state — requires manual operator reset",
      cooldownApplied: false,
      cooldownMs: 0,
      lockState: true,
      receiptId: "",
      confidence: 100,
    };
  }

  // 4. Check escalation: too many recoveries in window?
  const recoveryCount = getRecoveryCount(POLICY.recoveryWindowMs);
  if (shouldEscalate(recoveryCount)) {
    const action: RecoveryAction = "ENTER_LOCK_STATE";
    const receiptId = `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const receipt: DecisionReceipt = {
      id: receiptId,
      timestamp: Date.now(),
      degradationClass: degradation.class,
      selectedAction: action,
      precedence: "critical",
      reason: `Recovery limit exceeded (${recoveryCount}/${POLICY.maxRecoveriesPerWindow} in ${POLICY.recoveryWindowMs / 60000}min) → LOCK`,
      confidence: 100,
      cooldownApplied: false,
      cooldownMs: 0,
      lockState: true,
      evidenceSummary: degradation.evidence.slice(0, 5).join("; "),
    };
    writeReceipt(receipt);
    return {
      action,
      precedence: "critical",
      reason: receipt.reason,
      cooldownApplied: false,
      cooldownMs: 0,
      lockState: true,
      receiptId,
      confidence: 100,
    };
  }

  // 5. Check cooldown for last non-NO_OP action
  const lastReceipt = getLastReceipt();
  const lastAction = lastReceipt?.selectedAction;
  if (lastAction && lastAction !== "NO_OP") {
    const lastActionCooldown = ACTION_COOLDOWN[lastAction];
    if (lastActionCooldown > 0) {
      const elapsed = Date.now() - (lastReceipt?.timestamp || 0);
      if (elapsed < lastActionCooldown) {
        const remaining = Math.round((lastActionCooldown - elapsed) / 1000);
        return {
          action: "NO_OP",
          precedence: "low",
          reason: `In cooldown for ${lastAction} (${remaining}s remaining)`,
          cooldownApplied: true,
          cooldownMs: lastActionCooldown - elapsed,
          lockState: false,
          receiptId: "",
          confidence: 100,
        };
      }
    }
  }

  // 6. Select action based on degradation class
  const escalate = recoveryCount >= Math.floor(POLICY.maxRecoveriesPerWindow * 0.7);
  const selectedAction = selectAction(degradation, escalate);
  const precedence = ACTION_PRECEDENCE[selectedAction];
  const confidence = makeConfidence(degradation, selectedAction);
  const reason = makeReason(degradation, selectedAction, escalate);

  // 7. Generate receipt
  const receiptId = `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const receipt: DecisionReceipt = {
    id: receiptId,
    timestamp: Date.now(),
    degradationClass: degradation.class,
    selectedAction: selectedAction,
    precedence,
    reason,
    confidence,
    cooldownApplied: false,
    cooldownMs: 0,
    lockState: false,
    evidenceSummary: degradation.evidence.slice(0, 5).join("; "),
  };

  writeReceipt(receipt);

  return {
    action: selectedAction,
    precedence,
    reason,
    cooldownApplied: false,
    cooldownMs: 0,
    lockState: false,
    receiptId,
    confidence,
  };
}

// ============================================
// OPERATOR COMMAND HANDLERS
// ============================================

export function getOperatorStatus(): string {
  const state = getState();
  const lastReceipt = getLastReceipt();
  const recentReceipts = getRecentReceipts(5);

  let status = `🔧 Self-Heal Status\n\n`;
  status += `Lock State: ${isLockStateActive() ? "🔒 ACTIVE" : "✅ CLEAR"}\n`;
  status += `Recovery Count (5min): ${getRecoveryCountInWindow(POLICY.recoveryWindowMs)}/${POLICY.maxRecoveriesPerWindow}\n`;
  status += `Last Recovery: ${lastReceipt ? new Date(lastReceipt.timestamp).toISOString() : "none"}\n`;
  status += `Degradation: ${state.degradationReason || "none"}\n`;

  if (recentReceipts.length > 0) {
    status += `\n📋 Recent Decisions:\n`;
    recentReceipts.forEach(r => {
      status += `  ${new Date(r.timestamp).toLocaleTimeString()} ${r.selectedAction} — ${r.reason}\n`;
    });
  }

  return status;
}

export function operatorReset(): string {
  if (!isLockStateActive()) {
    return "✅ System not locked — no action needed";
  }
  clearLockState();
  return "✅ Lock state cleared. System recoverable.";
}
