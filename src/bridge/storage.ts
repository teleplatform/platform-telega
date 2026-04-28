import {
  type BridgeDocument,
  type TextChunk,
  type BridgeJob,
  createDocumentId,
  createJobId,
  nowIso,
} from "./contracts.js";
import { categorizeSize, SIZE_POLICY } from "./size-policy.js";
import { chunkTextSmart } from "./chunker.js";

const documentStore = new Map<string, BridgeDocument>();
const chunkStore = new Map<string, TextChunk[]>();
const jobStore = new Map<string, BridgeJob>();

export function createDocument(params: {
  userId: string;
  chatId: string;
  messageId: string;
  traceId: string;
  source: "telegram" | "web" | "alice";
  kind: "text" | "file" | "mixed";
  text?: string;
  fileMeta?: { fileName: string; mimeType: string; sizeBytes: number };
}): BridgeDocument {
  const documentId = createDocumentId("doc");
  const now = nowIso();
  const originalText = params.text || "";

  const doc: BridgeDocument = {
    documentId,
    source: params.source,
    userId: params.userId,
    chatId: params.chatId,
    messageId: params.messageId,
    traceId: params.traceId,
    kind: params.kind,
    title: params.fileMeta?.fileName,
    originalText,
    totalChars: originalText.length,
    totalChunks: 0,
    status: "received",
    checksum: "",
    createdAt: now,
    updatedAt: now,
  };

  documentStore.set(documentId, doc);
  return doc;
}

export function getDocument(documentId: string): BridgeDocument | null {
  return documentStore.get(documentId) || null;
}

export function chunkAndStoreDocument(documentId: string): TextChunk[] {
  const doc = documentStore.get(documentId);
  if (!doc || !doc.originalText) return [];

  const chunks = chunkTextSmart(doc.originalText);
  
  chunkStore.set(documentId, chunks);
  
  doc.totalChunks = chunks.length;
  doc.status = "chunked";
  doc.updatedAt = nowIso();
  documentStore.set(documentId, doc);
  
  return chunks;
}

export function getChunks(documentId: string): TextChunk[] {
  return chunkStore.get(documentId) || [];
}

export function createJob(params: {
  traceId: string;
  documentId: string;
  stage: BridgeJob["stage"];
}): BridgeJob {
  const jobId = createJobId();
  const now = nowIso();

  const job: BridgeJob = {
    jobId,
    traceId: params.traceId,
    documentId: params.documentId,
    stage: params.stage,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  jobStore.set(jobId, job);
  return job;
}

export function getJob(jobId: string): BridgeJob | null {
  return jobStore.get(jobId) || null;
}

export function updateJobStage(
  jobId: string,
  stage: BridgeJob["stage"],
  status: BridgeJob["status"],
  error?: string
): void {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.stage = stage;
  job.status = status;
  job.error = error;
  job.updatedAt = nowIso();
  jobStore.set(jobId, job);
}

export function processInput(params: {
  text: string;
  userId: string;
  chatId: string;
  messageId: string;
  source: "telegram" | "web" | "alice";
  fileMeta?: { fileName: string; mimeType: string; sizeBytes: number };
}): {
  documentId: string;
  sizeCheck: ReturnType<typeof categorizeSize>;
  isDirectSafe: boolean;
  shouldChunk: boolean;
  shouldFileFallback: boolean;
} {
  const { text, userId, chatId, messageId, source, fileMeta } = params;
  
  const doc = createDocument({
    userId,
    chatId,
    messageId,
    traceId: `trace_${Date.now()}`,
    source,
    kind: fileMeta ? "file" : "text",
    text,
    fileMeta,
  });

  const sizeCheck = categorizeSize(text.length);
  const isDirectSafe = sizeCheck.category === "short";
  const shouldChunk = sizeCheck.willChunk;
  const shouldFileFallback = sizeCheck.willFileFallback;

  if (shouldChunk) {
    chunkAndStoreDocument(doc.documentId);
  }

  return {
    documentId: doc.documentId,
    sizeCheck,
    isDirectSafe,
    shouldChunk,
    shouldFileFallback,
  };
}

export function getAssembledContext(documentId: string, maxChars?: number): string {
  const chunks = getChunks(documentId);
  if (!chunks.length) {
    const doc = getDocument(documentId);
    return doc?.originalText || "";
  }

  const limit = maxChars ?? SIZE_POLICY.directTextCharsMax;
  let total = "";
  
  for (const chunk of chunks) {
    if ((total + "\n\n" + chunk.content).length > limit) {
      break;
    }
    total = total ? `${total}\n\n${chunk.content}` : chunk.content;
  }
  
  return total || chunks[0]?.content || "";
}

export function clearOldDocuments(maxAgeMs: number = 3600000): void {
  const now = Date.now();
  
  for (const [docId, doc] of documentStore) {
    const created = new Date(doc.createdAt).getTime();
    if (now - created > maxAgeMs) {
      documentStore.delete(docId);
      chunkStore.delete(docId);
    }
  }
  
  for (const [jobId, job] of jobStore) {
    const created = new Date(job.createdAt).getTime();
    if (now - created > maxAgeMs) {
      jobStore.delete(jobId);
    }
  }
}