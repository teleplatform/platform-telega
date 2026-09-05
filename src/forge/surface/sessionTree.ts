import { SurfaceSession } from "./sessionTypes";
import { SessionRegistry } from "./sessionRegistry";

export function forkSession(
  parentSessionId: string,
  newTitle: string
): SurfaceSession | null {
  const parent = SessionRegistry.get(parentSessionId);
  if (!parent) return null;

  const child = SessionRegistry.create(
    parent.surfaceId,
    parent.surfaceType,
    newTitle || `${parent.title} (fork)`,
    parent.mode,
    { ...parent.providerLock }
  );

  // Link to parent
  SessionRegistry.update(child.sessionId, {
    parentSessionId,
    missionId: parent.missionId,
    memoryRefs: [...parent.memoryRefs],
    contextRefs: [...parent.contextRefs],
  });

  return SessionRegistry.get(child.sessionId);
}

export function getAncestors(sessionId: string): SurfaceSession[] {
  const result: SurfaceSession[] = [];
  let current = SessionRegistry.get(sessionId);

  while (current?.parentSessionId) {
    const parent = SessionRegistry.get(current.parentSessionId);
    if (parent) {
      result.push(parent);
      current = parent;
    } else {
      break;
    }
  }

  return result;
}

export function getChildren(sessionId: string): SurfaceSession[] {
  return SessionRegistry.getAll().filter((s) => s.parentSessionId === sessionId && s.status !== "archived");
}

export function getSessionTree(sessionId: string): {
  session: SurfaceSession | null;
  ancestors: SurfaceSession[];
  children: SurfaceSession[];
} {
  return {
    session: SessionRegistry.get(sessionId) || null,
    ancestors: getAncestors(sessionId),
    children: getChildren(sessionId),
  };
}
