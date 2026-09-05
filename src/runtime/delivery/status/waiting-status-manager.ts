import {
  type StatusTransport,
  type StatusProgress,
  type WaitingStatusState,
  CREATE_WAITING_STATUS_DELAY_MS,
  WAITING_STATUS_THROTTLE_MS,
  WAITING_STATUS_IDLE_TIMEOUT_MS,
} from "./waiting-status.types.js";
import { renderStatusText } from "./waiting-status-renderer.js";
import type { ConversationSessionStore } from "../../conversation/conversation-session-store.js";

export class WaitingStatusManager {
  private transport: StatusTransport;
  private runId: string;
  private sessionStore?: ConversationSessionStore;

  private readonly createdAt: number;
  private lastUpdateAt: number = 0;
  private createTimer: ReturnType<typeof setTimeout> | null = null;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private state: WaitingStatusState = "idle";
  private statusMessageId: number | null = null;
  private lastProgress: StatusProgress | null = null;

  private runtimeMode: string = "creator";

  constructor(
    transport: StatusTransport,
    runId: string,
    sessionStore?: ConversationSessionStore,
    runtimeMode?: string,
  ) {
    this.transport = transport;
    this.runId = runId;
    this.sessionStore = sessionStore;
    this.runtimeMode = runtimeMode ?? "creator";
    this.createdAt = Date.now();
  }

  private get isPublicMode(): boolean {
    return this.runtimeMode === "public";
  }

  start(): void {
    if (this.state !== "idle") return;
    this.state = "pending";
    this.createTimer = setTimeout(() => {
      this._createMessage();
    }, CREATE_WAITING_STATUS_DELAY_MS);
  }

  update(progress: StatusProgress): void {
    if (this.state === "completed" || this.state === "failed") return;

    this.lastProgress = progress;

    if (this.state === "idle") {
      this.start();
      return;
    }

    this._resetIdleTimer();

    const now = Date.now();
    if (now - this.lastUpdateAt < WAITING_STATUS_THROTTLE_MS) {
      if (!this.throttleTimer) {
        this.throttleTimer = setTimeout(() => {
          this.throttleTimer = null;
          this._render();
        }, WAITING_STATUS_THROTTLE_MS - (now - this.lastUpdateAt));
      }
      return;
    }

    this._render();
  }

  async finish(): Promise<void> {
    if (this.state === "completed" || this.state === "failed") return;

    if (this.state === "idle" || this.state === "pending") {
      this._cleanup();
      this.state = "completed";
      return;
    }

    this.state = "completed";
    this._renderImmediate({ kind: "completed" });
    this._cleanup();
    this._saveWaitingStatusId();
  }

  async fail(error?: string): Promise<void> {
    if (this.state === "completed" || this.state === "failed") return;

    if (this.state === "idle" || this.state === "pending") {
      this._cleanup();
      this.state = "failed";
      return;
    }

    this.state = "failed";
    const msg = error ?? "Не получилось завершить ответ. Сохранил всё, что удалось получить.";
    this._renderImmediate({ kind: "failed", message: msg });
    this._cleanup();
    this._saveWaitingStatusId();
  }

  getState(): WaitingStatusState {
    return this.state;
  }

  private _createMessage(): void {
    if (this.state !== "pending") return;
    this.state = "active";
    this._render();
  }

  private _render(): void {
    if (this.state !== "active") return;
    if (!this.lastProgress) return;

    this.lastUpdateAt = Date.now();
    this.lastProgress.elapsedMs = this.lastUpdateAt - this.createdAt;

    const text = renderStatusText(this.lastProgress, this.isPublicMode);
    this._sendOrEdit(text);
  }

  private _renderImmediate(progress: StatusProgress): void {
    const text = renderStatusText(progress, this.isPublicMode);
    if (this.statusMessageId) {
      this._safeEdit(text);
    } else {
      this._safeSend(text);
    }
  }

  private async _sendOrEdit(text: string): Promise<void> {
    if (this.statusMessageId) {
      await this._safeEdit(text);
    } else {
      const result = await this._safeSend(text);
      if (result?.messageId != null) {
        this.statusMessageId = result.messageId;
        this._resetIdleTimer();
      }
    }
  }

  private async _safeSend(text: string): Promise<{ messageId: number } | null> {
    try {
      return await this.transport.send(text);
    } catch {
      return null;
    }
  }

  private async _safeEdit(text: string): Promise<void> {
    try {
      await this.transport.edit(this.statusMessageId!, text);
      this._resetIdleTimer();
    } catch {
      this.statusMessageId = null;
      const result = await this._safeSend(text);
      if (result?.messageId != null) {
        this.statusMessageId = result.messageId;
      }
    }
  }

  private _saveWaitingStatusId(): void {
    if (!this.sessionStore || !this.statusMessageId) return;
    try {
      this.sessionStore.setLastWaitingStatusId(String(this.statusMessageId));
    } catch {
      // silent
    }
  }

  private _resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.idleTimer = setTimeout(() => {
      if (this.state === "active") {
        const base = renderStatusText(this.lastProgress ?? { kind: "bridge" }, this.isPublicMode);
        this._safeEdit(`${base}\n\n_Still working…_`);
      }
    }, WAITING_STATUS_IDLE_TIMEOUT_MS);
  }

  private _cleanup(): void {
    if (this.createTimer) {
      clearTimeout(this.createTimer);
      this.createTimer = null;
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
