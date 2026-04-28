export type ForgeEvidenceOperatorAction = {
    type: "recent";
    limit?: number;
} | {
    type: "failed";
    limit?: number;
} | {
    type: "blocked";
    limit?: number;
} | {
    type: "detail";
    invocationId: string;
} | {
    type: "stats";
};
export interface ForgeEvidenceOperatorResult {
    ok: boolean;
    text: string;
    error?: string;
}
export declare function canAccessEvidence(role: string): boolean;
export declare function handleEvidenceOperatorAction(userId: string, role: string, action: ForgeEvidenceOperatorAction): Promise<ForgeEvidenceOperatorResult>;
