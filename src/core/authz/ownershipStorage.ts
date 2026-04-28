// Persistent Ownership Storage — File-based with cache

import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import type {
  ActorId,
  ResourceKind,
  OwnershipRecord,
  SessionOwnership,
  WorkspaceOwnership,
  VisibilityScope,
} from "../../types/authz.js";
import type { AgentSessionId, Subject } from "../../types/agentRuntime.js";
import { ownershipRegistry } from "../authz/ownership.js";

export interface PersistentOwnershipStorageOptions {
  baseDir: string;
  maxCacheSize?: number;
}

export class PersistentOwnershipStorage {
  private baseDir: string;
  private maxCacheSize: number;
  private cache = new Map<string, OwnershipRecord>();

  constructor(options: PersistentOwnershipStorageOptions) {
    this.baseDir = options.baseDir;
    this.maxCacheSize = options.maxCacheSize ?? 500;
  }

  private sessionKey(sid: AgentSessionId): string {
    return `session:${sid}`;
  }

  private workspaceKey(workspaceId: string): string {
    return `workspace:${workspaceId}`;
  }

  async setSessionOwner(
    sid: AgentSessionId,
    actorId: ActorId,
    visibility: VisibilityScope = "private"
  ): Promise<void> {
    const sessionDir = join(this.baseDir, sid);
    await mkdir(sessionDir, { recursive: true });

    const record: OwnershipRecord = {
      resource_kind: "session",
      resource_id: sid,
      owner_id: actorId,
      created_at: new Date().toISOString(),
    };

    const ownerPath = join(sessionDir, "owner.json");
    await writeFile(ownerPath, JSON.stringify(record, null, 2));

    const sessionOwnership: SessionOwnership = {
      sid,
      owner_id: actorId,
      created_by: actorId,
      visibility,
      created_at: record.created_at,
    };

    const sessionPath = join(sessionDir, "session_ownership.json");
    await writeFile(sessionPath, JSON.stringify(sessionOwnership, null, 2));

    ownershipRegistry.registerOwnership(record);
    ownershipRegistry.setVisibilityPolicy("session", sid, {
      scope: visibility,
      allowed_actors: [actorId],
      allowed_roles: ["system", "internal"],
    });

    this.cache.set(this.sessionKey(sid), record);
    this.pruneCache();
  }

  async getSessionOwner(sid: AgentSessionId): Promise<OwnershipRecord | null> {
    const cached = this.cache.get(this.sessionKey(sid));
    if (cached) return cached;

    try {
      const ownerPath = join(this.baseDir, sid, "owner.json");
      const content = await readFile(ownerPath, "utf-8");
      const record: OwnershipRecord = JSON.parse(content);
      this.cache.set(this.sessionKey(sid), record);
      return record;
    } catch {
      return null;
    }
  }

  async verifySessionOwnership(
    sid: AgentSessionId,
    actorId: ActorId
  ): Promise<boolean> {
    const owner = await this.getSessionOwner(sid);
    if (!owner) return false;
    return owner.owner_id === actorId;
  }

  async setWorkspaceOwner(
    workspaceId: string,
    actorId: ActorId,
    visibility: VisibilityScope = "private"
  ): Promise<void> {
    const workspaceDir = join(this.baseDir, "_workspaces", workspaceId);
    await mkdir(workspaceDir, { recursive: true });

    const record: OwnershipRecord = {
      resource_kind: "workspace",
      resource_id: workspaceId,
      owner_id: actorId,
      created_at: new Date().toISOString(),
    };

    const ownerPath = join(workspaceDir, "owner.json");
    await writeFile(ownerPath, JSON.stringify(record, null, 2));

    const workspaceOwnership: WorkspaceOwnership = {
      workspace_id: workspaceId,
      owner_id: actorId,
      allowed_actors: [actorId],
      visibility,
      created_at: record.created_at,
      updated_at: record.created_at,
    };

    const workspacePath = join(workspaceDir, "workspace_ownership.json");
    await writeFile(workspacePath, JSON.stringify(workspaceOwnership, null, 2));

    ownershipRegistry.registerOwnership(record);
    ownershipRegistry.setVisibilityPolicy("workspace", workspaceId, {
      scope: visibility,
      allowed_actors: [actorId],
      allowed_roles: ["system", "internal"],
    });

    this.cache.set(this.workspaceKey(workspaceId), record);
    this.pruneCache();
  }

  async getWorkspaceOwner(workspaceId: string): Promise<OwnershipRecord | null> {
    const cached = this.cache.get(this.workspaceKey(workspaceId));
    if (cached) return cached;

    try {
      const ownerPath = join(this.baseDir, "_workspaces", workspaceId, "owner.json");
      const content = await readFile(ownerPath, "utf-8");
      const record: OwnershipRecord = JSON.parse(content);
      this.cache.set(this.workspaceKey(workspaceId), record);
      return record;
    } catch {
      return null;
    }
  }

  async verifyWorkspaceOwnership(
    workspaceId: string,
    actorId: ActorId
  ): Promise<boolean> {
    const owner = await this.getWorkspaceOwner(workspaceId);
    if (!owner) return false;
    return owner.owner_id === actorId;
  }

  async listSessionsForActor(actorId: ActorId): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await readdir(this.baseDir);
      for (const entry of entries) {
        if (entry.startsWith("_")) continue;
        const entryPath = join(this.baseDir, entry);
        const s = await stat(entryPath);
        if (!s.isDirectory()) continue;

        const owner = await this.getSessionOwner(entry);
        if (owner?.owner_id === actorId) {
          results.push(entry);
        }
      }
    } catch {
      // ignore
    }
    return results;
  }

  private pruneCache(): void {
    if (this.cache.size > this.maxCacheSize) {
      const keys = Array.from(this.cache.keys());
      const toRemove = keys.slice(0, this.cache.size - this.maxCacheSize);
      for (const key of toRemove) {
        this.cache.delete(key);
      }
    }
  }
}
