// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Launch Checklist
//
// Human-readable, short, actionable checklist aligned with actual
// runtime boundaries.
// ─────────────────────────────────────────────────────────────

import type { AlicePublishChecklistItem, AlicePublishReadinessReport } from "./types.js";

export function buildAlicePublishChecklist(readiness?: AlicePublishReadinessReport): AlicePublishChecklistItem[] {
  const checks = readiness?.checks;

  return [
    {
      id: "manifest",
      label: "Skill manifest ready and valid",
      status: checks?.manifestValid ? "done" : "pending",
      note: checks?.manifestValid ? undefined : "Manifest is missing or invalid",
    },
    {
      id: "invocation",
      label: "Invocation profile configured with entry phrases",
      status: checks?.invocationValid ? "done" : "pending",
      note: checks?.invocationValid ? undefined : "Entry phrases not configured",
    },
    {
      id: "endpoint",
      label: "Webhook endpoint path confirmed",
      status: checks?.endpointConfigured ? "done" : "pending",
      note: checks?.endpointConfigured ? undefined : "Endpoint path not declared",
    },
    {
      id: "environment",
      label: "Environment configured (env vars, routes)",
      status: checks?.environmentReady ? "done" : "pending",
      note: checks?.environmentReady ? undefined : "Some environment keys are missing",
    },
    {
      id: "secrets",
      label: "Secret mode confirmed (boundary verification)",
      status: checks?.requiredSecretsPresent ? "done" : "pending",
      note: checks?.requiredSecretsPresent ? undefined : "Required secrets missing",
    },
    {
      id: "hardening",
      label: "Ingress hardening enabled",
      status: checks?.hardeningEnabled ? "done" : "pending",
    },
    {
      id: "smoke",
      label: "Local smoke test passed",
      status: "pending",
      note: "Run local integration tests before publish",
    },
    {
      id: "validation",
      label: "Pre-publish validation passed",
      status: readiness?.readyToPublish ? "done" : "pending",
      note: readiness?.readyToPublish ? undefined : readiness?.blockers?.join("; "),
    },
  ];
}

export function getChecklistSummary(items: AlicePublishChecklistItem[]): { done: number; pending: number; blocked: number } {
  return {
    done: items.filter((i) => i.status === "done").length,
    pending: items.filter((i) => i.status === "pending").length,
    blocked: items.filter((i) => i.status === "blocked").length,
  };
}
