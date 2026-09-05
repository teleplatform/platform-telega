import { SurfaceSession, SessionStatus, SessionMode, SessionProviderLock } from "./sessionTypes";

const sessions = new Map<string, SurfaceSession>();

let counter = 0;
function genId(): string {
  counter++;
  return `sess_${Date.now()}_${counter}`;
}

export const SessionRegistry = {
  create(
    surfaceId: string,
    surfaceType: string,
    title: string,
    mode: SessionMode,
    providerLock?: SessionProviderLock
  ): SurfaceSession {
    const now = Date.now();
    const session: SurfaceSession = {
      sessionId: genId(),
      surfaceId,
      surfaceType,
      title,
      mode: mode || "public",
      status: "active",
      missionId: null,
      providerLock: providerLock || { mode: "auto", providerId: null, providerName: null },
      memoryRefs: [],
      contextRefs: [],
      parentSessionId: null,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };
    sessions.set(session.sessionId, session);
    return session;
  },

  get(id: string): SurfaceSession | undefined {
    return sessions.get(id);
  },

  getAll(): SurfaceSession[] {
    return Array.from(sessions.values()).sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  },

  update(id: string, updates: Partial<SurfaceSession>): SurfaceSession | null {
    const existing = sessions.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, sessionId: id, updatedAt: Date.now(), lastActivityAt: Date.now() };
    sessions.set(id, updated);
    return updated;
  },

  archive(id: string): SurfaceSession | null {
    return this.update(id, { status: "archived" });
  },

  delete(id: string): boolean {
    return sessions.delete(id);
  },

  listBySurface(surfaceId: string): SurfaceSession[] {
    return Array.from(sessions.values()).filter((s) => s.surfaceId === surfaceId && s.status !== "archived");
  },

  listByMission(missionId: string): SurfaceSession[] {
    return Array.from(sessions.values()).filter((s) => s.missionId === missionId);
  },

  listByStatus(status: SessionStatus): SurfaceSession[] {
    return Array.from(sessions.values()).filter((s) => s.status === status);
  },

  size(): number {
    return sessions.size;
  },
};
