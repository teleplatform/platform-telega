// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Request Helpers
//
// Extracts method, content-type, and body from incoming HTTP request.
// No raw payload goes further without extraction.
// ─────────────────────────────────────────────────────────────

import type { AliceHttpRequestEnvelope } from "./types.js";

export function extractHttpMethod(rawMethod: string | undefined): string {
  return (rawMethod ?? "").toUpperCase();
}

export function extractContentType(headers: Record<string, string | undefined>): string {
  const ct = headers["content-type"] ?? headers["Content-Type"] ?? "";
  // Strip charset suffix for comparison
  return ct.split(";")[0].trim().toLowerCase();
}

export function extractRequestBody(
  rawBody: unknown,
  maxBytes: number = 64 * 1024, // 64KB default safety guard
): Record<string, unknown> | null {
  if (rawBody === null || rawBody === undefined) return null;
  if (typeof rawBody !== "object") return null;

  // Size safety: reject obviously oversized objects
  const jsonStr = JSON.stringify(rawBody);
  if (jsonStr.length > maxBytes) return null;

  return rawBody as Record<string, unknown>;
}

export function buildHttpRequestEnvelope(
  method: string,
  headers: Record<string, string | undefined>,
  body: unknown,
): AliceHttpRequestEnvelope {
  return {
    method: extractHttpMethod(method) as "POST",
    headers,
    body: extractRequestBody(body),
    receivedAt: new Date().toISOString(),
  };
}

export function isMethodPost(envelope: AliceHttpRequestEnvelope): boolean {
  return envelope.method === "POST";
}

export function isContentTypeJson(envelope: AliceHttpRequestEnvelope): boolean {
  const ct = extractContentType(envelope.headers);
  return ct === "application/json";
}

export function hasRequestBody(envelope: AliceHttpRequestEnvelope): boolean {
  return envelope.body !== null && envelope.body !== undefined;
}
