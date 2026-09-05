import { RepairResult } from "./repairTypes";

export function formatRepairResult(result: RepairResult): string {
  const lines = [
    `🔄 *Repair Loop Result*`,
    ``,
    `Status: \`${result.status}\``,
    `Attempts: ${result.attempts}`,
    `Failure Class: \`${result.failureClass}\``,
    `Root Cause: ${result.rootCause || "—"}`,
    ``,
    `Patch Applied: ${result.patchApplied ? "✅" : "❌"}`,
    `Verification: ${result.verificationPassed ? "✅" : "❌"}`,
    `Rollback Used: ${result.rollbackUsed ? "⚠️" : "—"}`,
    `Evidence: ${result.evidenceCount} events`,
  ];
  return lines.join("\n");
}
