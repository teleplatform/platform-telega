import type { OutputRelayKind, WatchdogConfig } from "./output-relay.types.js";
import { DEFAULT_WATCHDOG_CONFIG } from "./output-relay.types.js";

interface SessionWatchState {
  relayId: string;
  kind: OutputRelayKind;
  createdAt: number;
  lastChangeAt: number;
  lastCharCount: number;
}

export class LongRunningTaskWatchdog {
  private config: WatchdogConfig;
  private sessions = new Map<string, SessionWatchState>();

  constructor(config?: Partial<WatchdogConfig>) {
    this.config = { ...DEFAULT_WATCHDOG_CONFIG, ...config };
  }

  registerSession(relayId: string, kind: OutputRelayKind): void {
    const now = Date.now();
    this.sessions.set(relayId, {
      relayId,
      kind,
      createdAt: now,
      lastChangeAt: now,
      lastCharCount: 0,
    });
  }

  unregisterSession(relayId: string): void {
    this.sessions.delete(relayId);
  }

  touch(relayId: string, charCount: number): void {
    const state = this.sessions.get(relayId);
    if (!state) return;
    state.lastChangeAt = Date.now();
    state.lastCharCount = charCount;
  }

  check(relayId: string, kind?: OutputRelayKind): { shouldStop: boolean; reason?: string } {
    const state = this.sessions.get(relayId);
    if (!state) return { shouldStop: false };

    const now = Date.now();
    const effectiveKind = kind ?? state.kind;
    const elapsed = now - state.createdAt;
    const idleElapsed = now - state.lastChangeAt;

    if (elapsed >= this.config.hard_timeout_ms) {
      return { shouldStop: true, reason: "hard_timeout" };
    }

    const idleLimit = effectiveKind === "image" ? this.config.idle_timeout_image_ms : this.config.idle_timeout_text_ms;
    if (idleElapsed >= idleLimit) {
      return { shouldStop: true, reason: "idle_timeout" };
    }

    return { shouldStop: false };
  }

  isSessionActive(relayId: string): boolean {
    return this.sessions.has(relayId);
  }

  getActiveCount(): number {
    return this.sessions.size;
  }

  getAllSessions(): SessionWatchState[] {
    return [...this.sessions.values()];
  }

  getConfig(): WatchdogConfig {
    return { ...this.config };
  }
}
