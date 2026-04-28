import { getState, updateHeartbeat, isLockStateActiveBoolean } from "./watchdog.state.js";
import { makeDecision } from "./decision-engine.js";
import { executeAction } from "./recovery-actions.js";

const CHECK_INTERVAL_MS = 15000;

export function startWatchdog(): void {
  console.log(`[watchdog] Starting with decision engine (interval ${CHECK_INTERVAL_MS}ms)`);

  setInterval(async () => {
    try {
      updateHeartbeat();

      // Get current state for decision engine
      const state = getState();
      const currentState = {
        consecutiveFailures: state.consecutiveFailures,
        lastRecovery: state.lastRecovery,
        isDegraded: state.isDegraded,
        lockState: state.lockStateActive,
        recoveryCount: state.recoveryCount,
      };

      // Make decision via decision engine
      const decision = makeDecision(currentState);

      if (!decision || decision.action === "NO_OP") {
        return;
      }

      console.log(
        `[watchdog] Degradation detected: ${decision.reason} → executing ${decision.action} (confidence: ${decision.confidence}%)`
      );

      // Execute recovery action
      const success = await executeAction(decision.action, decision.reason);

      if (!success && !isLockStateActiveBoolean()) {
        console.error("[watchdog] Recovery action failed, incrementing failure count");
        // This will be picked up by classifier as degradation
      }

    } catch (err) {
      console.error(`[watchdog] Check error: ${err}`);
    }
  }, CHECK_INTERVAL_MS);
}