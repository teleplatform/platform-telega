export function makeBootstrapScopeKey(): string { return "bootstrap:system"; }
export function makeOperatorScopeKey(actor_id: string): string { return `operator:${actor_id}`; }
export function makeWorkspaceScopeKey(workspace_id: string): string { return `workspace:${workspace_id}`; }
export function makeRunScopeKey(run_id: string): string { return `run:${run_id}`; }
export function makeCanonScopeKey(domain?: string): string { return `canon:${domain ?? "general"}`; }
export function makeEvidenceScopeKey(run_id: string): string { return `evidence:${run_id}`; }
