import type { ForgeEvidenceQuery } from "./forge-evidence-export.types.js";
import type { ForgeInvocationEvidenceRecord } from "./forge-invocation-evidence.types.js";
export declare function queryEvidence(query: ForgeEvidenceQuery): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function listEvidenceByUser(userId: string, limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function listEvidenceByTask(taskId: string): Promise<ForgeInvocationEvidenceRecord | null>;
export declare function listEvidenceByStatus(status: string, limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function listEvidenceTimeline(options?: {
    limit?: number;
    after?: string;
    before?: string;
}): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function listBlockedEvidence(limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function listFailedEvidence(limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function listSuccessfulEvidence(limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function getEvidenceStats(): Promise<{
    total: number;
    done: number;
    failed: number;
    blocked: number;
    started: number;
}>;
