/**
 * Voice Runtime Governance Gate — V12.4
 *
 * First-class entity: VoiceRuntimeGovernanceGate
 *
 * This layer answers:
 *   - "May this message reach Tele GPT?"
 *   - "What type of message is this and what checks apply?"
 *   - "Should this message be blocked, routed, or handled locally?"
 *
 * RULE: NO MESSAGE MAY REACH TELE GPT WITHOUT GOVERNANCE GATE
 */

export type VoiceMessageType =
  | "vault_command"
  | "ai_request"
  | "sensitive_request"
  | "health_query"
  | "unknown";

export type VoiceGateCheck =
  | "vault_command_bypass"
  | "bridge_enabled_check"
  | "sensitive_request_review"
  | "health_query_allowed"
  | "user_authorization"
  | "rate_limit_check";

export interface VoiceRuntimeGovernanceGate {
  gateId: string;
  messageType: VoiceMessageType;
  allowed: boolean;
  requiredChecks: VoiceGateCheck[];
  reason?: string;
  evaluatedAt: number;
}

export type VoiceGateValidationError =
  | "unknown_message_type"
  | "missing_required_checks"
  | "gate_not_evaluated";

// ============================================================================
// ID generation
// ============================================================================

function generateGateId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_gate_${timestamp}_${random}`;
}

function cryptoRandomHex(bytes: number): string {
  try {
    const { randomBytes } = require("node:crypto");
    return randomBytes(bytes).toString("hex");
  } catch {
    return Math.random().toString(16).slice(2, 2 + bytes * 2);
  }
}

// ============================================================================
// Message classification
// ============================================================================

export function classifyMessageType(message: string): VoiceMessageType {
  const lower = message.toLowerCase().trim();

  if (lower.startsWith("/")) return "vault_command";
  if (lower.includes("ключ") || lower.includes("secret") || lower.includes("token")) {
    return "sensitive_request";
  }
  if (
    lower.includes("статус") ||
    lower.includes("status") ||
    lower.includes("health") ||
    lower.includes("здоровье")
  ) {
    return "health_query";
  }
  return "ai_request";
}

// ============================================================================
// Gate evaluation
// ============================================================================

export interface VoiceGovernanceGateInput {
  message: string;
  bridgeEnabled: boolean;
  allowVaultInjection: boolean;
  userId?: string;
}

/**
 * Evaluate governance gate for a message.
 * Pure function — determines if message may reach Tele GPT.
 */
export function evaluateGovernanceGate(
  input: VoiceGovernanceGateInput,
): VoiceRuntimeGovernanceGate {
  const messageType = classifyMessageType(input.message);
  const checks: VoiceGateCheck[] = [];
  let allowed = true;
  let reason: string | undefined;

  switch (messageType) {
    case "vault_command":
      // Vault commands bypass Tele GPT entirely
      checks.push("vault_command_bypass");
      break;

    case "health_query":
      // Health queries handled locally
      checks.push("health_query_allowed");
      break;

    case "sensitive_request":
      checks.push("sensitive_request_review");
      checks.push("bridge_enabled_check");
      if (!input.bridgeEnabled) {
        allowed = false;
        reason = "Bridge disabled — sensitive requests require Tele GPT";
      }
      if (!input.allowVaultInjection) {
        allowed = false;
        reason = "Vault injection disabled for sensitive requests";
      }
      break;

    case "ai_request":
      checks.push("bridge_enabled_check");
      if (!input.bridgeEnabled) {
        allowed = false;
        reason = "Tele GPT bridge is disabled (TELEGPT_BRIDGE_ENABLED=false)";
      }
      break;

    default:
      checks.push("bridge_enabled_check");
      if (!input.bridgeEnabled) {
        allowed = false;
        reason = "Bridge disabled — unknown message types require Tele GPT";
      }
  }

  return {
    gateId: generateGateId(),
    messageType,
    allowed,
    requiredChecks: checks,
    reason,
    evaluatedAt: Date.now(),
  };
}

// ============================================================================
// Validation
// ============================================================================

export function validateGovernanceGate(
  gate: Partial<VoiceRuntimeGovernanceGate>,
): VoiceGateValidationError[] {
  const errors: VoiceGateValidationError[] = [];

  if (!gate.messageType) {
    errors.push("unknown_message_type");
  }

  if (gate.requiredChecks && gate.requiredChecks.length === 0 && gate.messageType !== "vault_command") {
    errors.push("missing_required_checks");
  }

  if (gate.evaluatedAt === undefined) {
    errors.push("gate_not_evaluated");
  }

  return errors;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatGovernanceGate(gate: VoiceRuntimeGovernanceGate): string {
  const typeEmoji: Record<VoiceMessageType, string> = {
    vault_command: "🔐",
    ai_request: "🧠",
    sensitive_request: "⚠️",
    health_query: "💚",
    unknown: "❓",
  };

  const status = gate.allowed ? "✅ PASSED" : "❌ BLOCKED";

  return [
    `🚦 Runtime Governance Gate`,
    `• gate ID: ${gate.gateId}`,
    `• type: ${typeEmoji[gate.messageType]} ${gate.messageType}`,
    `• status: ${status}`,
    gate.reason ? `• reason: ${gate.reason}` : null,
    `• checks: ${gate.requiredChecks.join(", ")}`,
    `• evaluated: ${new Date(gate.evaluatedAt).toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}
