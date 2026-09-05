import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { OutputBuffer } from "./output-buffer.js";
import { LongRunningTaskWatchdog } from "./long-running-task-watchdog.js";
import type { OutputRelaySession, OutputRelayKind } from "./output-relay.types.js";

export class StreamingOutputObserver {
  readonly buffer: OutputBuffer;
  readonly watchdog: LongRunningTaskWatchdog;
  private sessions = new Map<string, OutputRelaySession>();
  private pollTimers = new Map<string, ReturnType<typeof setInterval>>();
  private pollFn: (relayId: string) => Promise<string>;

  constructor(buffer?: OutputBuffer, watchdog?: LongRunningTaskWatchdog, pollFn?: (relayId: string) => Promise<string>) {
    this.buffer = buffer ?? new OutputBuffer();
    this.watchdog = watchdog ?? new LongRunningTaskWatchdog();
    this.pollFn = pollFn ?? (async () => "");
  }

  createSession(relayId: string, runId: string, traceId: string, providerId: string, chatId: string, kind: OutputRelayKind = "text"): OutputRelaySession {
    const now = new Date().toISOString();
    const session: OutputRelaySession = {
      relay_id: relayId,
      run_id: runId,
      trace_id: traceId,
      provider_id: providerId,
      chat_id: chatId,
      kind,
      status: "created",
      counters: { chars_seen: 0, chars_delivered: 0, chunks_delivered: 0, images_detected: 0 },
      timestamps: { created_at: now, last_change_at: now, last_heartbeat_at: now },
    };
    this.sessions.set(relayId, session);
    this.watchdog.registerSession(relayId, kind);
    appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "output_relay_session_created"),
      trace_id: traceId,
      job_id: "delivery",
      type: "output_relay_session_created" as any,
      timestamp: new Date().toISOString(),
      payload: { relay_id: relayId, provider_id: providerId, kind },
    });
    return session;
  }

  getSession(relayId: string): OutputRelaySession | undefined {
    return this.sessions.get(relayId);
  }

  getAllSessions(): OutputRelaySession[] {
    return [...this.sessions.values()];
  }

  async pollOnce(relayId: string): Promise<{ changed: boolean; newTail: string; session: OutputRelaySession }> {
    const session = this.sessions.get(relayId);
    if (!session) throw new Error(`No relay session '${relayId}'`);

    const oldText = this.buffer.getFullText(relayId);
    const latestRaw = await this.pollFn(relayId);
    const newTail = latestRaw.length > oldText.length ? latestRaw.slice(oldText.length) : "";

    if (newTail) {
      this.buffer.appendTail(relayId, newTail);
      session.counters.chars_seen = this.buffer.getCharCount(relayId);
      session.timestamps.last_change_at = new Date().toISOString();
      session.status = "streaming";

      appendEvidenceRecord({
        evidence_id: hashTraceId(session.trace_id, "output_stream_observed"),
        trace_id: session.trace_id,
        job_id: "delivery",
        type: "output_stream_observed" as any,
        timestamp: new Date().toISOString(),
        payload: { relay_id: relayId, new_chars: newTail.length, total_chars: session.counters.chars_seen },
      });

      return { changed: true, newTail, session };
    }

    return { changed: false, newTail: "", session };
  }

  startPolling(relayId: string, intervalMs = 2000): void {
    if (this.pollTimers.has(relayId)) return;

    const timer = setInterval(async () => {
      const session = this.sessions.get(relayId);
      if (!session) return this.stopPolling(relayId);

      const check = this.watchdog.check(relayId, session.kind);
      if (check.shouldStop) {
        session.status = check.reason === "hard_timeout" ? "failed" : "partial";
        session.timestamps.completed_at = new Date().toISOString();
        this.stopPolling(relayId);
        return;
      }

      await this.pollOnce(relayId);
      this.watchdog.touch(relayId, this.buffer.getCharCount(relayId));
    }, intervalMs);

    this.pollTimers.set(relayId, timer);
  }

  stopPolling(relayId: string): void {
    const timer = this.pollTimers.get(relayId);
    if (timer) {
      clearInterval(timer);
      this.pollTimers.delete(relayId);
    }
  }

  completeSession(relayId: string): void {
    const session = this.sessions.get(relayId);
    if (session) {
      session.status = "completed";
      session.counters.chars_seen = this.buffer.getCharCount(relayId);
      session.timestamps.completed_at = new Date().toISOString();
      appendEvidenceRecord({
        evidence_id: hashTraceId(session.trace_id, "output_relay_completed"),
        trace_id: session.trace_id,
        job_id: "delivery",
        type: "output_relay_completed" as any,
        timestamp: new Date().toISOString(),
        payload: { relay_id: relayId, total_chars: session.counters.chars_seen },
      });
    }
    this.stopPolling(relayId);
    this.watchdog.unregisterSession(relayId);
  }

  failSession(relayId: string, reason: string): void {
    const session = this.sessions.get(relayId);
    if (session) {
      session.status = "failed";
      session.timestamps.completed_at = new Date().toISOString();
      appendEvidenceRecord({
        evidence_id: hashTraceId(session.trace_id, "output_relay_failed"),
        trace_id: session.trace_id,
        job_id: "delivery",
        type: "output_relay_failed" as any,
        timestamp: new Date().toISOString(),
        payload: { relay_id: relayId, reason },
      });
    }
    this.stopPolling(relayId);
    this.watchdog.unregisterSession(relayId);
  }

  partialSession(relayId: string, reason: string): void {
    const session = this.sessions.get(relayId);
    if (session) {
      session.status = "partial";
      session.timestamps.completed_at = new Date().toISOString();
      appendEvidenceRecord({
        evidence_id: hashTraceId(session.trace_id, "output_relay_partial"),
        trace_id: session.trace_id,
        job_id: "delivery",
        type: "output_relay_partial" as any,
        timestamp: new Date().toISOString(),
        payload: { relay_id: relayId, reason, chars_buffered: this.buffer.getCharCount(relayId) },
      });
    }
    this.stopPolling(relayId);
    this.watchdog.unregisterSession(relayId);
  }
}
