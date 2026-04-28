import type { ForgeInvocationEvidenceRecord } from "./forge-invocation-evidence.types.js";
export declare function getRecentEvidence(limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function getFailedEvidence(limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function getBlockedEvidence(limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function getSuccessfulEvidence(limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function getEvidenceByInvocationId(invocationId: string): Promise<ForgeInvocationEvidenceRecord | null>;
export declare function getEvidenceByTaskId(taskId: string): Promise<ForgeInvocationEvidenceRecord | null>;
export declare function getEvidenceByUser(userId: string, limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function getEvidenceByTarget(target: string, limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function getEvidenceByKind(kind: string, limit?: number): Promise<ForgeInvocationEvidenceRecord[]>;
export declare function getEvidenceStats(): Promise<{
    total: number;
    done: number;
    failed: number;
    blocked: number;
    started: number;
}>;
