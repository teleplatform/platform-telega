// Ownership Storage - Store and verify session ownership

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { AgentSessionId, Subject } from "../../../types/agentRuntime.js";

export interface OwnershipRecord {
  sid: AgentSessionId;
  owner_subject: Subject;
  created_at: string;
}

export interface OwnershipStorage {
  setOwner(sid: AgentSessionId, ownerSubject: Subject): Promise<void>;
  getOwner(sid: AgentSessionId): Promise<Subject | null>;
  verifyOwnership(sid: AgentSessionId, subject: Subject): Promise<boolean>;
}

export class FileOwnershipStorage implements OwnershipStorage {
  private evidenceDir: string;
  private cache = new Map<AgentSessionId, Subject>();

  constructor(evidenceDir: string = "./evidence") {
    this.evidenceDir = evidenceDir;
  }

  async setOwner(sid: AgentSessionId, ownerSubject: Subject): Promise<void> {
    const sessionDir = join(this.evidenceDir, sid);
    await mkdir(sessionDir, { recursive: true });

    const record: OwnershipRecord = {
      sid,
      owner_subject: ownerSubject,
      created_at: new Date().toISOString(),
    };

    // Write to file
    const ownerPath = join(sessionDir, "owner.json");
    await writeFile(ownerPath, JSON.stringify(record, null, 2));

    // Update cache
    this.cache.set(sid, ownerSubject);
  }

  async getOwner(sid: AgentSessionId): Promise<Subject | null> {
    // Check cache first
    if (this.cache.has(sid)) {
      return this.cache.get(sid)!;
    }

    // Read from file
    try {
      const ownerPath = join(this.evidenceDir, sid, "owner.json");
      const content = await readFile(ownerPath, "utf-8");
      const record: OwnershipRecord = JSON.parse(content);

      // Update cache
      this.cache.set(sid, record.owner_subject);
      return record.owner_subject;
    } catch (error) {
      // File doesn't exist or can't be read
      return null;
    }
  }

  async verifyOwnership(sid: AgentSessionId, subject: Subject): Promise<boolean> {
    const owner = await this.getOwner(sid);
    if (!owner) {
      return false;
    }

    // Check if subject is owner or maker
    if (subject === owner) {
      return true;
    }

    // Check if subject is maker
    if (subject.startsWith("maker:")) {
      return true;
    }

    return false;
  }
}
