// Actor Model — Resolve subject into canonical Actor

import type { Actor, ActorKind, ActorRole, ActorId, Subject } from "../../types/authz.js";

const SYSTEM_ACTOR_ID: ActorId = "actor:system";
const INTERNAL_ACTOR_ID: ActorId = "actor:internal";

export function parseSubject(subject: Subject): { kind: ActorKind; rawId: string } | null {
  if (!subject || typeof subject !== "string") return null;

  const colonIdx = subject.indexOf(":");
  if (colonIdx < 0) return null;

  const kindStr = subject.substring(0, colonIdx);
  const rawId = subject.substring(colonIdx + 1);

  const kindMap: Record<string, ActorKind> = {
    tg: "telegram",
    api: "api",
    user: "user",
    maker: "maker",
    system: "system",
    internal: "internal",
  };

  const kind = kindMap[kindStr];
  if (!kind) return null;

  return { kind, rawId };
}

export function subjectToRole(kind: ActorKind): ActorRole {
  switch (kind) {
    case "system":
      return "system";
    case "internal":
      return "internal";
    case "maker":
      return "creator";
    default:
      return "public";
  }
}

export function resolveActor(subject: Subject): Actor | null {
  const parsed = parseSubject(subject);
  if (!parsed) return null;

  const { kind, rawId } = parsed;
  const role = subjectToRole(kind);

  return {
    id: subject,
    kind,
    role,
    subject,
    isMaker: kind === "maker",
    isSystem: kind === "system",
    isInternal: kind === "internal",
  };
}

export function createSystemActor(): Actor {
  return {
    id: SYSTEM_ACTOR_ID,
    kind: "system",
    role: "system",
    subject: "system:runtime",
    isMaker: false,
    isSystem: true,
    isInternal: true,
  };
}

export function createInternalActor(): Actor {
  return {
    id: INTERNAL_ACTOR_ID,
    kind: "internal",
    role: "internal",
    subject: "internal:runtime",
    isMaker: false,
    isSystem: false,
    isInternal: true,
  };
}

export function isSystemActor(actor: Actor): boolean {
  return actor.isSystem || actor.role === "system";
}

export function isInternalActor(actor: Actor): boolean {
  return actor.isInternal || actor.role === "internal";
}

export function isMakerActor(actor: Actor): boolean {
  return actor.isMaker || actor.kind === "maker";
}
