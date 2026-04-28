// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Endpoint Metadata
//
// Declares the publish target endpoint.
// No "we'll figure out the URL later" — this is the declared endpoint.
// ─────────────────────────────────────────────────────────────

// Canonical webhook path for Alice ingress
const DEFAULT_WEBHOOK_PATH = "/api/v1/alice/webhook";

export function getAliceWebhookPublishPath(): string {
  // In production, this could come from env config
  return process.env.ALICE_WEBHOOK_PATH ?? DEFAULT_WEBHOOK_PATH;
}

export type AliceEndpointRegistrationMeta = {
  url: string;
  method: "POST";
  contentType: "application/json";
  expectsHardening: boolean;
  expectsProtocolAdapter: boolean;
};

export function buildAliceEndpointRegistrationMeta(baseUrl?: string): AliceEndpointRegistrationMeta {
  const path = getAliceWebhookPublishPath();
  const fullUrl = baseUrl ? `${baseUrl.replace(/\/+$/, "")}${path}` : path;

  return {
    url: fullUrl,
    method: "POST",
    contentType: "application/json",
    expectsHardening: true,
    expectsProtocolAdapter: true,
  };
}
