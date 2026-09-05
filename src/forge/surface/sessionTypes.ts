export type SessionStatus = "active" | "idle" | "archived";
export type SessionMode = "public" | "creator" | "debug";
export type SessionProviderMode = "auto" | "manual" | "off";

export interface SessionProviderLock {
  mode: SessionProviderMode;
  providerId: string | null;
  providerName: string | null;
}

export interface SurfaceSession {
  sessionId: string;
  surfaceId: string;
  surfaceType: string;
  title: string;
  mode: SessionMode;
  status: SessionStatus;
  missionId: string | null;
  providerLock: SessionProviderLock;
  memoryRefs: string[];
  contextRefs: string[];
  parentSessionId: string | null;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
}

export interface SessionFork {
  childSessionId: string;
  parentSessionId: string;
  createdAt: number;
}
