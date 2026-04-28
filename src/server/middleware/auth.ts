// Auth Middleware — Subject Extraction and AuthZ Context Attachment

import type { FastifyRequest, FastifyReply } from "fastify";
import { attachAuthZContext, getSubjectFromRequest } from "../../core/authz/guard.js";
import type { AuthZContext } from "../../types/authz.js";

export type Subject = string;
export type SubjectKind = "telegram" | "api" | "user" | "maker" | "system" | "internal";

export interface AuthContext {
  subject: Subject;
  subjectKind: SubjectKind;
  isMaker: boolean;
}

export function extractSubject(req: FastifyRequest): AuthContext | null {
  const subject = getSubjectFromRequest(req);
  if (!subject) return null;

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

  const subjectKind = kindMap[kindStr] ?? "user";

  return {
    subject,
    subjectKind,
    isMaker: subjectKind === "maker",
  };
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const authContext = extractSubject(req);

  if (!authContext) {
    reply.code(401).send({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "No valid subject found in request",
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
        message: "Failed to resolve actor from subject",
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
