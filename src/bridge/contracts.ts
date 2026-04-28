export type PayloadSource = "telegram" | "web" | "alice";

export type InboundKind = "text" | "file" | "mixed";

export interface InboundPayload {
  source: PayloadSource;
  userId: string;
  chatId: string;
  messageId: string;
  traceId: string;
  kind: InboundKind;
  text?: string;
  fileMeta?: FileMeta;
  createdAt: string;
}

export interface FileMeta {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface BridgeDocument {
  documentId: string;
  source: PayloadSource;
  userId: string;
  chatId: string;
  messageId: string;
  traceId: string;
  kind: InboundKind;
  title?: string;
  originalText?: string;
  totalChars: number;
  totalChunks: number;
  status: DocumentStatus;
  checksum: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus =
  | "received"
  | "chunked"
  | "assembled"
  | "processed"
  | "failed";

export interface TextChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  totalChunks: number;
  content: string;
  charCount: number;
  tokenEstimate: number;
  checksum: string;
}

export type AssembleMode = "full" | "windowed" | "summarize-first";

export interface AssembleContextRequest {
  documentId: string;
  userPrompt?: string;
  mode: AssembleMode;
  maxChars?: number;
}

export interface ModelContext {
  documentId: string;
  preamble: string;
  selectedChunks: TextChunk[];
  totalSelectedChars: number;
}

export interface BridgeJob {
  jobId: string;
  traceId: string;
  documentId: string;
  stage: JobStage;
  status: JobStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobStage =
  | "ingress"
  | "normalize"
  | "chunk"
  | "store"
  | "assemble"
  | "model_call"
  | "output";

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface OutputResult {
  ok: boolean;
  method: "text" | "chunked" | "file";
  content?: string;
  chunks?: string[];
  filePath?: string;
  fileName?: string;
  caption?: string;
  error?: string;
}

export function createDocumentId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}