// PD-W3/B4-A — Canonical Trusted Execution Context boundary.
//
// The ONLY identity the Dispatch execution path will accept is a
// TrustedExecutionContext produced here from a server-verified identity
// record. This module is the closed contract: identity is NEVER derived from
// request payload, headers, body, ChatRequest.meta, or any untrusted string.
//
// B4 governance rulings (locked):
//   - Anonymous/public chat stays on routeChat (intentional legacy boundary).
//   - No synthetic public identity: no anonymous:*, no user:anonymous, no
//     system:runtime fallback, no fabricated actor.
//   - ChatRequest must remain identity-free; meta is never a trust source.
//   - Reuse the existing TrustedExecutionContext authority (B2). Do NOT
//     introduce a parallel DispatchTrustedContext model.

import type { Actor } from "../../types/authz.js";

/**
 * CENTRAL closed set of trusted identity sources.
 *
 * A source may be added ONLY in a dedicated batch that can prove an exact
 * server-controlled construction point that cannot originate from request
 * payload/meta.
 *
 * Locked set for B4-A:
 *   - "gateway.authentication.verified_api_key" (B2, existing authority)
 *
 * Explicitly NOT present in B4-A (no verified construction point today):
 *   bridge.internal, worker.executor, system, internal, user, telegram.
 */
export const TRUSTED_SOURCES = [
  "gateway.authentication.verified_api_key",
] as const;

export type TrustedSource = (typeof TRUSTED_SOURCES)[number];

export function isTrustedSource(value: unknown): value is TrustedSource {
  return (
    typeof value === "string" &&
    (TRUSTED_SOURCES as readonly string[]).includes(value)
  );
}

/**
 * Canonical subject grammar, bound per trusted source.
 *
 * A subject that does not match the source grammar is REJECTED at
 * construction time, so no untrusted string (meta subject, header, body
 * field, self-asserted actor) can mint a context under a trusted source.
 */
export const TRUSTED_SOURCE_SUBJECT_PATTERN: Record<TrustedSource, RegExp> = {
  // api:key_<epoch_ms>_<hex> — derived by the gateway from the verification
  // server-side API-key record id. Never from the raw token.
  "gateway.authentication.verified_api_key": /^api:key_[0-9]+_[a-f0-9]+$/,
};

// Nominal brand: only createTrustedExecutionContext can produce this type.
declare const TRUSTED_CONTEXT_BRAND: unique symbol;

export interface TrustedExecutionContext {
  readonly [TRUSTED_CONTEXT_BRAND]: "trusted-execution-context";
  readonly subject: string;
  readonly actor: Actor | null;
  readonly source: TrustedSource;
}