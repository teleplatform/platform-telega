import { PatchProposal, PatchVerification, PatchApplyResult, PatchReport } from "./patchTypes";

export function buildPatchReport(
  proposal: PatchProposal,
  verification: PatchVerification,
  applyResult: PatchApplyResult | null
): PatchReport {
  return {
    proposal,
    verification,
    applyResult,
    completedAt: Date.now(),
  };
}
