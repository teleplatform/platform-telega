import { randomUUID } from "crypto";

export function makeRunId(): string { return `run_${randomUUID()}`; }
export function makeGraphId(): string { return `graph_${randomUUID()}`; }
export function makeEventId(): string { return `evt_${randomUUID()}`; }
export function makeCapsuleId(): string { return `capsule_${randomUUID()}`; }
export function makeArtifactId(): string { return `artifact_${randomUUID()}`; }
