// AuthZ Guard — Unified authorization layer

import type { FastifyRequest, FastifyReply } from "fastify";
import type {
  Actor,
  Action,
  ResourceKind,
  AuthZContext,
  PermissionDecision,
} from "../../types/authz.js";
import { resolveActor } from "./actor.js";
import { defaultPermissionResolver, PermissionResolver } from "./permissions.js";
import { ownershipRegistry } from "./ownership.js";
import { denyLogger } from "./deny.js";

export interface GuardOptions {
  action: Action;
  resourceKind: ResourceKind;
  resourceId: string;
  resolver?: PermissionResolver;
}

export interface GuardResult {
  allowed: boolean;
  decision: PermissionDecision;
  reason?: string;
  actor: Actor;
}

export function getSubjectFromRequest(req: FastifyRequest): string | null {
  const authContext = (req as any).authContext;
  if (authContext?.subject) return authContext.subject;

  const telegramUserId = req.headers["x-telegram-user-id"] as string;
  if (telegramUserId) return `tg:${telegramUserId}`;

  const makerRole = req.headers["x-maker-role"] as string;
  if (makerRole === "true" || makerRole === "1") {
    const makerId = (req.headers["x-maker-id"] as string) ?? "system";
    return `maker:${makerId}`;
  }

  const authHeader = req.headers["authorization"] as string;
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      return `user:${token.substring(0, 8)}`;
    }
    if (authHeader.startsWith("API-Key ")) {
      const apiKey = authHeader.substring(8);
      return `api:${apiKey.substring(0, 8)}`;
    }
  }

  return null;
}

export function attachAuthZContext(req: FastifyRequest): AuthZContext | null {
  const subject = getSubjectFromRequest(req);
  if (!subject) return null;

  const actor = resolveActor(subject);
  if (!actor) return null;

  const profile = defaultPermissionResolver.buildProfile(actor);

  (req as any).authZContext = {
    actor,
    profile,
    visibility_policy: null,
  } satisfies AuthZContext;

  return (req as any).authZContext as AuthZContext;
}

export function getAuthZContext(req: FastifyRequest): AuthZContext | null {
  return (req as any).authZContext ?? null;
}

export function authzGuard(
  actor: Actor,
  action: Action,
  resourceKind: ResourceKind,
  resourceId: string,
  resolver: PermissionResolver = defaultPermissionResolver
): GuardResult {
  const isOwner = ownershipRegistry.isOwner(resourceKind, resourceId, actor.id);
  const { decision, reason } = resolver.checkPermission(actor, action, isOwner);

  if (decision === "allow") {
    return { allowed: true, decision, actor };
  }

  denyLogger.logTraceDeny(
    actor.id,
    action,
    resourceKind,
    resourceId,
    reason ?? "unknown"
  );

  return { allowed: false, decision, reason, actor };
}

export function createAuthzMiddleware(options: GuardOptions) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = getAuthZContext(req);
    if (!ctx) {
      return reply.status(401).send({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "No valid actor context",
        },
      });
    }

    const resourceId = options.resourceId;
    const result = authzGuard(
      ctx.actor,
      options.action,
      options.resourceKind,
      resourceId,
      options.resolver
    );

    if (!result.allowed) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: result.reason ?? "Access denied",
          reason: result.reason,
        },
      });
    }
  };
}

export function sessionGuard(
  actor: Actor,
  action: Action,
  sid: string
): GuardResult {
  return authzGuard(actor, action, "session", sid);
}

export function evidenceGuard(
  actor: Actor,
  action: Action,
  sid: string
): GuardResult {
  return authzGuard(actor, action, "evidence", sid);
}

export function workspaceGuard(
  actor: Actor,
  action: Action,
  workspaceId: string
): GuardResult {
  return authzGuard(actor, action, "workspace", workspaceId);
}
