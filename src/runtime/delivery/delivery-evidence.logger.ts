import { appendEvidence, getMetrics, getRecentEvidence } from "./delivery-evidence.store.js";
import { dedupGuard } from "./delivery-dedup.js";
import type { DeliveryEvidenceRecord, DeliveryStatus } from "./delivery-evidence.types.js";

export function logDeliveryEvidence(record: DeliveryEvidenceRecord) {
  // Dedup guard: skip if same status+reason within TTL
  const key = `${record.status}:${record.reason || ""}`;
  if (!dedupGuard(key)) return;

  appendEvidence(record);

  // Real-time critical signal for errors
  if (record.status === "error") {
    console.warn(
      "[delivery.CRITICAL]",
      JSON.stringify({
        traceId: record.traceId?.slice(0, 16),
        status: record.status,
        provider: record.provider,
        reason: record.reason,
        createdAt: record.createdAt,
      })
    );
  }

  console.log(
    "[delivery.evidence]",
    JSON.stringify({
      traceId: record.traceId?.slice(0, 16),
      status: record.status,
      provider: record.provider,
      chunks: record.chunks,
      reason: record.reason || null,
    })
  );
}

export function logSuccess(traceId: string, chatId: number, provider: string, transport: string, inputLen: number, outputLen: number, chunks: number) {
  logDeliveryEvidence({
    traceId,
    chatId,
    provider,
    transport: transport as any,
    inputLength: inputLen,
    outputLength: outputLen,
    chunks,
    status: "success",
    createdAt: Date.now(),
  });
}

export function logBlocked(traceId: string, chatId: number, provider: string, transport: string, inputLen: number, outputLen: number, reason: string) {
  logDeliveryEvidence({
    traceId,
    chatId,
    provider,
    transport: transport as any,
    inputLength: inputLen,
    outputLength: outputLen,
    chunks: 0,
    status: "blocked",
    reason,
    createdAt: Date.now(),
  });
}

export function logError(traceId: string, chatId: number, provider: string, transport: string, inputLen: number, reason: string) {
  logDeliveryEvidence({
    traceId,
    chatId,
    provider,
    transport: transport as any,
    inputLength: inputLen,
    outputLength: 0,
    chunks: 0,
    status: "error",
    reason,
    createdAt: Date.now(),
  });
}

export { getMetrics, getRecentEvidence };