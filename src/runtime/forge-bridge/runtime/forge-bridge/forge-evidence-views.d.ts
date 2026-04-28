export interface ForgeEvidenceListItem {
    index: number;
    invocationId: string;
    taskId: string;
    status: string;
    target: string;
    kind: string;
    summary: string;
    startedAt: string;
    finishedAt?: string;
}
export interface ForgeEvidenceDetailView {
    invocationId: string;
    taskId: string;
    traceId?: string;
    userId: string;
    role: string;
    chatId?: string;
    action: string;
    target: string;
    kind: string;
    adapter?: string;
    status: string;
    summary: string;
    renderedText?: string;
    blockedReason?: string;
    errorCode?: string;
    errorMessage?: string;
    startedAt: string;
    finishedAt?: string;
}
export interface ForgeEvidenceStatsView {
    total: number;
    done: number;
    failed: number;
    blocked: number;
    started: number;
}
export declare function buildRecentEvidenceView(limit?: number): Promise<ForgeEvidenceListItem[]>;
export declare function buildFailedEvidenceView(limit?: number): Promise<ForgeEvidenceListItem[]>;
export declare function buildBlockedEvidenceView(limit?: number): Promise<ForgeEvidenceListItem[]>;
export declare function buildSuccessfulEvidenceView(limit?: number): Promise<ForgeEvidenceListItem[]>;
export declare function buildInvocationDetailView(invocationId: string): Promise<ForgeEvidenceDetailView | null>;
export declare function buildUserEvidenceView(userId: string, limit?: number): Promise<ForgeEvidenceListItem[]>;
export declare function buildTargetEvidenceView(target: string, limit?: number): Promise<ForgeEvidenceListItem[]>;
export declare function buildEvidenceStatsView(): Promise<ForgeEvidenceStatsView>;
