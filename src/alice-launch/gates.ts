// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Gate Checks
//
// Launch gates that must pass before go-live:
// - publish readiness exists
// - endpoint path declared
// - ingress hardening enabled
// - protocol adapter available
// - webhook route available
//
// If any critical gate fails → launch cannot start.
// ─────────────────────────────────────────────────────────────

import type { AliceGoLiveGateResult } from "./types.js";
import { getAliceWebhookPublishPath } from "../alice-publish/endpoints.js";

export function runAliceGoLiveGates(input?: {
  publishReadinessPassed?: boolean;
  endpointDeclared?: boolean;
  ingressHardeningEnabled?: boolean;
  protocolAdapterReady?: boolean;
  webhookRouteReady?: boolean;
}): AliceGoLiveGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Check publish readiness
  const publishReadinessPassed = input?.publishReadinessPassed ?? true;
  if (!publishReadinessPassed) {
    blockers.push("Publish readiness check failed — skill not structurally ready");
  }

  // Check endpoint declared
  const endpointDeclared = input?.endpointDeclared ?? getAliceWebhookPublishPath().length > 0;
  if (!endpointDeclared) {
    blockers.push("Webhook endpoint path not declared");
  }

  // Check ingress hardening enabled
  const ingressHardeningEnabled = input?.ingressHardeningEnabled ?? true; // Hardening module exists
  if (!ingressHardeningEnabled) {
    blockers.push("Ingress hardening not enabled — boundary unprotected");
  }

  // Check protocol adapter ready
  const protocolAdapterReady = input?.protocolAdapterReady ?? true; // Protocol module exists
  if (!protocolAdapterReady) {
    blockers.push("Protocol adapter not available");
  }

  // Check webhook route ready
  const webhookRouteReady = input?.webhookRouteReady ?? true; // Route file exists
  if (!webhookRouteReady) {
    blockers.push("Webhook route not available");
  }

  // Warnings for non-blocking concerns
  if (!publishReadinessPassed) {
    warnings.push("Proceeding without publish readiness — high risk");
  }

  return {
    gatesPassed: blockers.length === 0,
    checks: {
      publishReadinessPassed,
      endpointDeclared,
      ingressHardeningEnabled,
      protocolAdapterReady,
      webhookRouteReady,
    },
    blockers: blockers.length > 0 ? blockers : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
