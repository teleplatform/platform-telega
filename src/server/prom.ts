import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const errorsTotal = new client.Counter({
  name: "telegpt_errors_total",
  help: "Total number of normalized errors",
  labelNames: ["code", "kind", "provider", "model"],
  registers: [register],
});

export const httpLatencyMs = new client.Histogram({
  name: "telegpt_http_latency_ms",
  help: "HTTP request latency in milliseconds",
  buckets: [10, 25, 50, 100, 200, 350, 500, 750, 1000, 2000, 5000, 10000, 15000],
  labelNames: ["provider", "model", "status"],
  registers: [register],
});

export const guardrails429Total = new client.Counter({
  name: "telegpt_guardrails_429_total",
  help: "Total number of 429 responses grouped by guardrail reason",
  labelNames: ["reason"],
  registers: [register],
});

export function promContentType() {
  return register.contentType;
}

export async function promMetricsText() {
  return await register.metrics();
}

export function normalizeModelLabel(model?: string) {
  if (!model) return "none";
  return model.length > 64 ? model.slice(0, 64) : model;
}

export function normalizeProviderLabel(provider?: unknown) {
  return typeof provider === "string" && provider.length ? provider : "unknown";
}

export function normalizeKindLabel(kind?: unknown) {
  return typeof kind === "string" && kind.length ? kind : "none";
}

export function normalizeCodeLabel(code?: unknown) {
  return typeof code === "string" && code.length ? code : "none";
}
