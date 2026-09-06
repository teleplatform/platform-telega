// Auth Middleware — Subject Extraction and AuthZ Context Attachment
//
// UI-4G/G1.9 — Runtime Identity Trust. These routes are REMOTE HTTP protected
// routes (agent run/stream/verify, approvals approve/deny, forge/operator/
// governance/override/recovery/repair consequential mutations). A subject may
// only be trusted when it is backed by a SERVER-VERIFIED credential issued by
// the API-key store (api-keys/store.ts, validateApiKey). Self-asserted identity
// headers (x-maker-role/x-maker-id, x-telegram-user-id, or a non-verifiable
// opaque Bearer) are NOT a trust root and are rejected (401) on these routes.
//
// This trust model mirrors the IDE Gateway (gateway/auth.ts). Untouched by this
// change: public read catalogs (no authMiddleware), the Telegram /chat surface,
// worker/mesh/federation namespaces (separate trust), the global policyGate
// quota/rate, and any in-process function-call paths.
//
// A "maker needs to act as the UI user" flow therefore authenticates the
// SERVICE with a provisioned API key; user attribution is the caller's concern.

import type { FastifyRequest, FastifyReply } from "fastify";
import { attachAuthZContext, getSubjectFromRequest } from "../../core/authz/guard.js";
import { validateApiKey } from "../../api-keys/store.js";
import type { AuthZContext } from "../../types/authz.js";

export type Subject = string;
export type SubjectKind = "telegram" | "api" | "user" | "maker" | "system" | "internal";

export interface AuthContext {
  subject: Subject;
  subjectKind: SubjectKind;
  isMaker: boolean;
}

function colonKind(subject: string): SubjectKind {
  const colonIdx = subject.indexOf(":");
  const kindStr = colonIdx >= 0 ? subject.substring(0, colonIdx) : "";
  const kindMap: Record<string, SubjectKind> = {
    tg: "telegram",
    api: "api",
    user: "user",
    maker: "maker",
    system: "system",
    internal: "internal",
  };
  return kindMap[kindStr] ?? "user";
}

export function extractSubject(req: FastifyRequest): AuthContext | null {
  const subject = getSubjectFromRequest(req);
  if (!subject) return null;
  return { subject, subjectKind: colonKind(subject), isMaker: colonKind(subject) === "maker" };
}

/**
 * G1.9 trust gate: derive a *server-verified* subject from the Authorization
 * header (Api-Key or Bearer carrying a `tgpt_sk_*` credential issued by the
 * store). Returns null when there is no verifiable credential.
 */
function verifiedSubjectFromRequest(req: FastifyRequest): AuthContext | null {
  // A caller may legitimately pre-attach a trusted context only via explicit
  // internal plumbing; honor it if present. Nothing sets this from headers.
  const existing = (req as any).authContext?.subject as string | undefined;
  if (existing) {
    return { subject: existing, subjectKind: colonKind(existing), isMaker: colonKind(existing) === "maker" };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.startsWith("API-Key ")
      ? authHeader.slice(8).trim()
      : "";

  if (!token) return null;
  const result = validateApiKey(token);
  if (!result.valid || !result.key) return null;

  const subject = `api:${token.slice(0, 8)}`;
  return { subject, subjectKind: "api", isMaker: false };
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const authContext = verifiedSubjectFromRequest(req);

  if (!authContext) {
    reply.code(401).send({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message:
          "No server-verified credential. Protected Runtime actions require a valid issued API key (Authorization: Bearer tgpt_sk_...) or a trusted pre-attached subject.",
      },
    });
    return;
  }

  (req as any).authContext = authContext;

  const authZContext = attachAuthZContext(req);
  if (!authZContext) {
    reply.code(401).send({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Failed to resolve actor from authenticated subject",
      },
    });
    return;
  }
}

export function getAuthContext(req: FastifyRequest): AuthContext {
  return (req as any).authContext;
}

export function getAuthZContext(req: FastifyRequest): AuthZContext | null {
  return (req as any).authZContext ?? null;
}
