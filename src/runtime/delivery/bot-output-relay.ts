import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { DeliveryChunker } from "./delivery-chunker.js";
import type { OutputChunk, OutputRelaySession, ChunkingOptions } from "./output-relay.types.js";

export interface BotDeliveryResult {
  chunk_id: string;
  index: number;
  success: boolean;
  error?: string;
}

export class BotOutputRelay {
  readonly chunker: DeliveryChunker;
  private chunks = new Map<string, OutputChunk[]>();
  private heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  private onSendChunk: (chunk: OutputChunk) => Promise<boolean>;
  private onSendHeartbeat: (session: OutputRelaySession, pending: OutputChunk[]) => Promise<void>;

  constructor(
    onSendChunk: (chunk: OutputChunk) => Promise<boolean>,
    onSendHeartbeat?: (session: OutputRelaySession, pending: OutputChunk[]) => Promise<void>,
    chunkingOptions?: Partial<ChunkingOptions>,
  ) {
    this.chunker = new DeliveryChunker(chunkingOptions);
    this.onSendChunk = onSendChunk;
    this.onSendHeartbeat = onSendHeartbeat ?? (async () => {});
  }

  prepareChunks(relayId: string, text: string): OutputChunk[] {
    const chunks = this.chunker.chunk(relayId, text);
    this.chunks.set(relayId, chunks);

    for (const chunk of chunks) {
      appendEvidenceRecord({
        evidence_id: hashTraceId(relayId, "output_chunk_created"),
        trace_id: relayId,
        job_id: "delivery",
        type: "output_chunk_created" as any,
        timestamp: new Date().toISOString(),
        payload: { relay_id: relayId, chunk_id: chunk.chunk_id, index: chunk.index, chars: chunk.chars },
      });
    }

    return chunks;
  }

  async deliverAll(relayId: string, session: OutputRelaySession): Promise<BotDeliveryResult[]> {
    const chunks = this.chunks.get(relayId);
    if (!chunks || chunks.length === 0) return [];

    const results: BotDeliveryResult[] = [];

    for (const chunk of chunks) {
      const success = await this.onSendChunk(chunk);
      chunk.delivered = success;
      session.counters.chunks_delivered = chunks.filter((c) => c.delivered).length;
      session.counters.chars_delivered = chunks.filter((c) => c.delivered).reduce((s, c) => s + c.chars, 0);

      appendEvidenceRecord({
        evidence_id: hashTraceId(session.trace_id, "output_chunk_delivered"),
        trace_id: session.trace_id,
        job_id: "delivery",
        type: "output_chunk_delivered" as any,
        timestamp: new Date().toISOString(),
        payload: { relay_id: relayId, chunk_id: chunk.chunk_id, index: chunk.index, success },
      });

      results.push({ chunk_id: chunk.chunk_id, index: chunk.index, success, error: success ? undefined : "Delivery failed" });
    }

    return results;
  }

  async deliverChunk(relayId: string, index: number): Promise<BotDeliveryResult> {
    const chunks = this.chunks.get(relayId);
    if (!chunks || index >= chunks.length) {
      return { chunk_id: "", index, success: false, error: "Chunk not found" };
    }
    const chunk = chunks[index];
    const success = await this.onSendChunk(chunk);
    chunk.delivered = success;
    return { chunk_id: chunk.chunk_id, index, success, error: success ? undefined : "Delivery failed" };
  }

  startHeartbeat(session: OutputRelaySession, intervalMs: number): void {
    if (this.heartbeatTimers.has(session.relay_id)) return;

    const timer = setInterval(async () => {
      const pending = this.getPendingChunks(session.relay_id);
      session.timestamps.last_heartbeat_at = new Date().toISOString();
      await this.onSendHeartbeat(session, pending);

      appendEvidenceRecord({
        evidence_id: hashTraceId(session.trace_id, "output_heartbeat_sent"),
        trace_id: session.trace_id,
        job_id: "delivery",
        type: "output_heartbeat_sent" as any,
        timestamp: new Date().toISOString(),
        payload: { relay_id: session.relay_id, chars_seen: session.counters.chars_seen, chunks_pending: pending.length },
      });
    }, intervalMs);

    this.heartbeatTimers.set(session.relay_id, timer);
  }

  stopHeartbeat(relayId: string): void {
    const timer = this.heartbeatTimers.get(relayId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(relayId);
    }
  }

  getChunks(relayId: string): OutputChunk[] {
    return this.chunks.get(relayId) ?? [];
  }

  getPendingChunks(relayId: string): OutputChunk[] {
    return (this.chunks.get(relayId) ?? []).filter((c) => !c.delivered);
  }

  removeSession(relayId: string): void {
    this.stopHeartbeat(relayId);
    this.chunks.delete(relayId);
  }
}
