import type { ForgeInvocationEvidenceRecord, ForgeInvocationStatus } from "./forge-invocation-evidence.types.js";
export declare function buildForgeInvocationAuditLine(record: ForgeInvocationEvidenceRecord): string;
export declare function buildForgeInvocationSummaryLine(record: ForgeInvocationEvidenceRecord): string;
export declare function getStatusEmoji(status: ForgeInvocationStatus): string;
export declare function formatEvidenceForExport(record: ForgeInvocationEvidenceRecord): Record<string, unknown>;
