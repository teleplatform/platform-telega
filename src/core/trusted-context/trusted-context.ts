// PD-W3/B4-A — Trusted context construction control.
//
// Construction belongs to verified boundary adapters ONLY. There is
// deliberately NO helper of the shape:
//   fromSubject(subject) / fromMeta(meta) / fromHeaders(rawHeaders) / fromBody(body)
//
// The caller MUST supply a canonical derived subject + actor that already
// came from a server-verified identity record (gateway: verified API key
// -> server-side key record -> canonical api:<id> -> TrustedExecutionContext).
// No raw token may enter the context.

import type { Actor } from "../../types/authz.js";
import type { ChatRequest } from "../../types/chat.js";
import {
  TRUSTED_SOURCE_SUBJECT_PATTERN,
  isTrustedSource,
  type TrustedExecutionContext,
  type TrustedSource,
} from "./trusted-context.types.js";

// ─── ChatRequest negative contract (compile-time proof) ────────────────────
// ChatRequest MUST remain identity-free. If any forbidden key is ever added,
// the full-server tsc (npm run build -> tsc -p tsconfig.server.json) fails
// HERE, before the field could ever be respected as a trust source.
type _Repro<T extends true> = T;
type _HasNoKey<K extends string, T> = K extends keyof T ? false : true;

const _chatRequestIdentityFree: _Repro<
  _HasNoKey<"subject", ChatRequest> &
    _HasNoKey<"actor", ChatRequest> &
    _HasNoKey<"authz", ChatRequest> &
    _HasNoKey<"trustedExecutionContext", ChatRequest> &
    _HasNoKey<"trusted_context", ChatRequest> &
    _HasNoKey<"userId", ChatRequest> &
    _HasNoKey<"user_id", ChatRequest> &
    _HasNoKey<"identity", ChatRequest> &
    _HasNoKey<"auth", ChatRequest> &
    _HasNoKey<"api_key", ChatRequest>
> = true;

const RAW_TOKEN_PREFIX = "tgpt_sk_";

export class TrustedContextConstructionError extends Error {
  readonly reason_code:
    | "unknown_source"
    | "subject_grammar_mismatch"
    | "raw_token_in_subject"
    | "actor_subject_mismatch";

  constructor(
    message: string,
    reasonCode: TrustedContextConstructionError["reason_code"],
  ) {
    super(message);
    this.name = "TrustedContextConstructionError";
    this.reason_code = reasonCode;
  }
}

export function createTrustedExecutionContext(input: {
  subject: string;
  actor: Actor | null;
  source: TrustedSource;
}): TrustedExecutionContext {
  if (!isTrustedSource(input.source)) {
    throw new TrustedContextConstructionError(
      `unknown trusted source: ${JSON.stringify(input.source)}`,
      "unknown_source",
    );
  }

  if (input.subject.includes(RAW_TOKEN_PREFIX)) {
    throw new TrustedContextConstructionError(
      "raw token material must never enter a trusted context",
      "raw_token_in_subject",
    );
  }

  const pattern = TRUSTED_SOURCE_SUBJECT_PATTERN[input.source];
  if (!pattern.test(input.subject)) {
    throw new TrustedContextConstructionError(
      `subject ${JSON.stringify(input.subject)} does not match canonical grammar for source ${input.source}`,
      "subject_grammar_mismatch",
    );
  }

  if (input.actor && input.actor.subject !== input.subject) {
    throw new TrustedContextConstructionError(
      `actor.subject (${JSON.stringify(input.actor?.subject)}) must equal the derived subject (${JSON.stringify(input.subject)})`,
      "actor_subject_mismatch",
    );
  }

  return Object.freeze({
    subject: input.subject,
    actor: input.actor,
    source: input.source,
  }) as TrustedExecutionContext;
}