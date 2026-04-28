interface SmokeResult {
    ok: boolean;
    name: string;
    error?: string;
}
declare function runOperatorSmokeTest(): Promise<{
    ok: boolean;
    passed: number;
    failed: number;
    results: SmokeResult[];
}>;
export declare function runForgeOperatorSmoke(): Promise<void>;
export { runOperatorSmokeTest };
