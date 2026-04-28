/**
 * Voice Feature Flag Governance — V12.5
 *
 * First-class entity: VoiceFeatureFlags
 *
 * This layer answers:
 *   - "Is the Tele GPT bridge enabled?"
 *   - "Should we fail-open to local mode when Tele GPT is down?"
 *   - "Are vault secret injections allowed?"
 *
 * RULE: NO RUNTIME BEHAVIOR WITHOUT FEATURE FLAG CONTROL
 */

export interface VoiceFeatureFlags {
  /** Main switch: route messages to Tele GPT */
  bridgeEnabled: boolean;
  /** If Tele GPT down: fallback to local vs error */
  failOpenLocal: boolean;
  /** Allow ${vault:...} injection in messages */
  allowVaultInjection: boolean;
  /** Auto-delete secret responses after N seconds */
  autoDeleteSecretAfterSec: number;
  /** Max message length to forward to Tele GPT */
  maxMessageLength: number;
}

export const DEFAULT_FEATURE_FLAGS: VoiceFeatureFlags = {
  bridgeEnabled: true,
  failOpenLocal: false,
  allowVaultInjection: true,
  autoDeleteSecretAfterSec: 30,
  maxMessageLength: 4000,
};

export type VoiceFeatureFlagValidationError =
  | "invalid_auto_delete_value"
  | "invalid_max_message_length";

// ============================================================================
// Loading from environment
// ============================================================================

export function loadFeatureFlagsFromEnv(): VoiceFeatureFlags {
  return {
    bridgeEnabled: process.env.TELEGPT_BRIDGE_ENABLED !== "false",
    failOpenLocal: process.env.TELEGPT_BRIDGE_FAILOPEN_LOCAL === "true",
    allowVaultInjection: process.env.TELEGPT_BRIDGE_VAULT_INJECTION !== "false",
    autoDeleteSecretAfterSec: parseInt(
      process.env.TELEGPT_BRIDGE_AUTO_DELETE_SEC ?? "30",
      10,
    ),
    maxMessageLength: parseInt(
      process.env.TELEGPT_BRIDGE_MAX_MSG_LEN ?? "4000",
      10,
    ),
  };
}

// ============================================================================
// Validation
// ============================================================================

export function validateFeatureFlags(
  flags: Partial<VoiceFeatureFlags>,
): VoiceFeatureFlagValidationError[] {
  const errors: VoiceFeatureFlagValidationError[] = [];

  if (
    flags.autoDeleteSecretAfterSec !== undefined &&
    (flags.autoDeleteSecretAfterSec < 0 || flags.autoDeleteSecretAfterSec > 300)
  ) {
    errors.push("invalid_auto_delete_value");
  }

  if (
    flags.maxMessageLength !== undefined &&
    (flags.maxMessageLength < 100 || flags.maxMessageLength > 10000)
  ) {
    errors.push("invalid_max_message_length");
  }

  return errors;
}

// ============================================================================
// Feature flag state
// ============================================================================

let _currentFlags: VoiceFeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

export function getCurrentFeatureFlags(): VoiceFeatureFlags {
  return { ..._currentFlags };
}

export function setFeatureFlags(flags: VoiceFeatureFlags): void {
  const errors = validateFeatureFlags(flags);
  if (errors.length > 0) {
    throw new Error(`Invalid feature flags: ${errors.join(", ")}`);
  }
  _currentFlags = { ...flags };
}

export function updateFeatureFlag<K extends keyof VoiceFeatureFlags>(
  key: K,
  value: VoiceFeatureFlags[K],
): void {
  const updated = { ..._currentFlags, [key]: value };
  const errors = validateFeatureFlags(updated);
  if (errors.length > 0) {
    throw new Error(`Invalid feature flag value: ${errors.join(", ")}`);
  }
  _currentFlags[key] = value;
}

export function resetFeatureFlags(): void {
  _currentFlags = { ...DEFAULT_FEATURE_FLAGS };
}

export function setFeatureFlagsForTest(flags: VoiceFeatureFlags | null): void {
  _currentFlags = flags ?? { ...DEFAULT_FEATURE_FLAGS };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatFeatureFlags(flags: VoiceFeatureFlags): string {
  const status = (enabled: boolean) => (enabled ? "✅" : "❌");

  return [
    `🏛️ Feature Flags`,
    `• Bridge enabled: ${status(flags.bridgeEnabled)}`,
    `• Fail-open local: ${status(flags.failOpenLocal)}`,
    `• Vault injection: ${status(flags.allowVaultInjection)}`,
    `• Auto-delete secrets: ${flags.autoDeleteSecretAfterSec}s`,
    `• Max message length: ${flags.maxMessageLength}`,
  ].join("\n");
}
