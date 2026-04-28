// Ownership Truth — Canonical ownership resolution

import type {
  ActorId,
  ResourceKind,
  OwnershipRecord,
  OwnershipClaim,
  VisibilityScope,
  VisibilityPolicy,
} from "../../types/authz.js";
import { isSystemActor, isInternalActor } from "./actor.js";
import type { Actor } from "../../types/authz.js";

export class OwnershipRegistry {
  private records = new Map<string, OwnershipRecord>();
  private visibilityPolicies = new Map<string, VisibilityPolicy>();

  private key(kind: ResourceKind, id: string): string {
    return `${kind}:${id}`;
  }

  registerOwnership(record: OwnershipRecord): void {
    this.records.set(this.key(record.resource_kind, record.resource_id), record);
  }

  getOwner(kind: ResourceKind, id: string): OwnershipRecord | null {
    return this.records.get(this.key(kind, id)) ?? null;
  }

  isOwner(kind: ResourceKind, id: string, actorId: ActorId): boolean {
    const record = this.getOwner(kind, id);
    if (!record) return false;
    return record.owner_id === actorId;
  }

  setVisibilityPolicy(kind: ResourceKind, id: string, policy: VisibilityPolicy): void {
    this.visibilityPolicies.set(this.key(kind, id), policy);
  }

  getVisibilityPolicy(kind: ResourceKind, id: string): VisibilityPolicy | null {
    return this.visibilityPolicies.get(this.key(kind, id)) ?? null;
  }

  checkVisibilityAccess(
    kind: ResourceKind,
    id: string,
    actor: Actor
  ): boolean {
    const policy = this.getVisibilityPolicy(kind, id);

    if (!policy) {
      return this.isOwner(kind, id, actor.id);
    }

    switch (policy.scope) {
      case "public":
        return true;
      case "internal":
        return actor.isInternal || actor.isSystem || this.isOwner(kind, id, actor.id);
      case "shared":
        return (
          policy.allowed_actors.includes(actor.id) ||
          policy.allowed_roles.includes(actor.role) ||
          this.isOwner(kind, id, actor.id)
        );
      case "private":
        return this.isOwner(kind, id, actor.id);
      default:
        return false;
    }
  }

  canAccess(
    kind: ResourceKind,
    id: string,
    actor: Actor
  ): boolean {
    if (isSystemActor(actor) || isInternalActor(actor)) {
      return true;
    }

    if (this.isOwner(kind, id, actor.id)) {
      return true;
    }

    return this.checkVisibilityAccess(kind, id, actor);
  }
}

export const ownershipRegistry = new OwnershipRegistry();
