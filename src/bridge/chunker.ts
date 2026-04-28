import { createDocumentId, nowIso, type TextChunk } from "./contracts.js";
import { SIZE_POLICY } from "./size-policy.js";

function createChecksum(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function chunkTextSmart(text: string, target?: number, hardMax?: number): TextChunk[] {
  const targetSize = target ?? SIZE_POLICY.chunkTargetChars;
  const hardLimit = hardMax ?? SIZE_POLICY.chunkHardMaxChars;

  const safeText = text || "";
  if (safeText.length <= targetSize) {
    const documentId = createDocumentId("doc");
    return [{
      id: `${documentId}_0`,
      documentId,
      chunkIndex: 0,
      totalChunks: 1,
      content: safeText,
      charCount: safeText.length,
      tokenEstimate: Math.ceil(safeText.length / 4),
      checksum: createChecksum(safeText),
    }];
  }

  const paragraphs = safeText.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buffer = "";

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    const candidate = buffer ? `${buffer}\n\n${trimmed}` : trimmed;

    if (candidate.length <= targetSize) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
      buffer = "";
    }

    if (trimmed.length <= hardLimit) {
      buffer = trimmed;
      continue;
    }

    const lines = trimmed.split("\n");
    let lineBuffer = "";
    for (const line of lines) {
      const lineCandidate = lineBuffer ? `${lineBuffer}\n${line}` : line;
      if (lineCandidate.length <= targetSize) {
        lineBuffer = lineCandidate;
        continue;
      }
      if (lineBuffer) {
        chunks.push(lineBuffer);
        lineBuffer = "";
      }
      if (line.length <= hardLimit) {
        lineBuffer = line;
        continue;
      }
      for (let i = 0; i < line.length; i += hardLimit) {
        chunks.push(line.slice(i, i + hardLimit));
      }
    }
    if (lineBuffer) chunks.push(lineBuffer);
  }

  if (buffer) chunks.push(buffer);

  const documentId = createDocumentId("doc");

  return chunks.map((content, index) => ({
    id: `${documentId}_${index}`,
    documentId,
    chunkIndex: index,
    totalChunks: chunks.length,
    content,
    charCount: content.length,
    tokenEstimate: Math.ceil(content.length / 4),
    checksum: createChecksum(content),
  }));
}

export function reassembleChunks(chunks: TextChunk[]): string {
  if (!chunks?.length) return "";
  
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  return sorted.map(c => c.content).join("\n\n");
}

export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}