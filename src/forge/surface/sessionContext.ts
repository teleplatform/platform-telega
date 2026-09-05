import { SurfaceSession } from "./sessionTypes";
import { SessionRegistry } from "./sessionRegistry";

export function linkMission(sessionId: string, missionId: string): SurfaceSession | null {
  return SessionRegistry.update(sessionId, { missionId });
}

export function setProviderLock(
  sessionId: string,
  mode: "auto" | "manual" | "off",
  providerId?: string,
  providerName?: string
): SurfaceSession | null {
  return SessionRegistry.update(sessionId, {
    providerLock: { mode, providerId: providerId || null, providerName: providerName || null },
  });
}

export function addMemoryRef(sessionId: string, memoryId: string): SurfaceSession | null {
  const session = SessionRegistry.get(sessionId);
  if (!session) return null;
  if (!session.memoryRefs.includes(memoryId)) {
    session.memoryRefs.push(memoryId);
  }
  return SessionRegistry.update(sessionId, { memoryRefs: session.memoryRefs });
}

export function addContextRef(sessionId: string, contextId: string): SurfaceSession | null {
  const session = SessionRegistry.get(sessionId);
  if (!session) return null;
  if (!session.contextRefs.includes(contextId)) {
    session.contextRefs.push(contextId);
  }
  return SessionRegistry.update(sessionId, { contextRefs: session.contextRefs });
}

export function touchSession(sessionId: string): void {
  SessionRegistry.update(sessionId, { lastActivityAt: Date.now() });
}
