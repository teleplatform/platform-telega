import type { RecoveryLevel } from "./watchdog.types.js";
import { recordRecovery } from "./watchdog.state.js";

export async function executeRecovery(level: RecoveryLevel): Promise<void> {
  console.log(`[watchdog] Executing ${level} recovery`);
  
  switch (level) {
    case "soft":
      await softRecovery();
      break;
    case "medium":
      await mediumRecovery();
      break;
    case "hard":
      await hardRecovery();
      break;
  }
}

async function softRecovery(): Promise<void> {
  console.log("[watchdog] Soft recovery: resetting state");
  recordRecovery("soft");
}

async function mediumRecovery(): Promise<void> {
  console.log("[watchdog] Medium recovery: reconnecting bridge");
  recordRecovery("medium");
}

async function hardRecovery(): Promise<void> {
  console.log("[watchdog] Hard recovery: restarting launchd service");
  
  const { exec } = await import("child_process");
  
  return new Promise((resolve) => {
    exec("launchctl kickstart -k com.telegpt.bot", (err) => {
      if (err) {
        console.error("[watchdog] Hard recovery failed:", err);
      } else {
        console.log("[watchdog] Service restarted");
      }
      recordRecovery("hard");
      resolve();
    });
  });
}