import path from "path";
import fs from "fs/promises";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const DELIVERY_LOG_FILE = path.join(TELEGA_DIR, "delivery-log.jsonl");

export type DeliveryMode = "single" | "chunks" | "file";
export type DeliveryStatus = "started" | "chunk_sent" | "file_sent" | "completed" | "truncated" | "failed";

export interface DeliveryRecord {
  delivery_id: string;
  user_id: string;
  chat_id: string;
  extracted_text_length: number;
  delivered_text_length: number;
  chunks_count: number;
  delivery_mode: DeliveryMode;
  status: DeliveryStatus;
  message_ids: string[];
  file_path?: string;
  created_at: number;
  completed_at?: number;
}

const CHUNK_SIZE = 3500;
const MAX_CHUNKS = 5;
const MAX_SINGLE_MESSAGE = 3500;
const MAX_TOTAL_SIZE = 12000;

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function appendDeliveryRecord(record: DeliveryRecord): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(record) + "\n";
    await fs.appendFile(DELIVERY_LOG_FILE, line, "utf-8");
  } catch (e) {
    console.error("[delivery] write failed", e);
  }
}

export async function deliverFullOutput(
  ctx: any,
  text: string,
  options?: {
    title?: string;
    language?: string;
    file_ext?: string;
    reply_to_message_id?: number;
  }
): Promise<DeliveryRecord> {
  const userId = String(ctx.from?.id || "unknown");
  const chatId = String(ctx.chat?.id || "unknown");
  
  const record: DeliveryRecord = {
    delivery_id: makeId("dlv"),
    user_id: userId,
    chat_id: chatId,
    extracted_text_length: text.length,
    delivered_text_length: 0,
    chunks_count: 0,
    delivery_mode: "single",
    status: "started",
    message_ids: [],
    created_at: Date.now(),
  };
  
  try {
    await ensureDir();
    
    if (text.length <= MAX_SINGLE_MESSAGE) {
      return await deliverSingle(ctx, record, text, options);
    }
    
    const chunks = smartSplit(text, CHUNK_SIZE);
    
    if (chunks.length <= MAX_CHUNKS && text.length <= MAX_TOTAL_SIZE) {
      return await deliverChunks(ctx, record, chunks, options);
    }
    
    return await deliverAsFile(ctx, record, text, options);
    
  } catch (e: any) {
    console.error("[delivery] failed", e);
    record.status = "failed";
    await appendDeliveryRecord(record);
    throw e;
  }
}

async function deliverSingle(
  ctx: any,
  record: DeliveryRecord,
  text: string,
  options?: { title?: string; reply_to_message_id?: number }
): Promise<DeliveryRecord> {
  record.delivery_mode = "single";
  
  const content = options?.title ? `${options.title}\n\n${text}` : text;
  
  try {
    const msg = await ctx.reply(content, {
      reply_to_message_id: options?.reply_to_message_id,
      parse_mode: undefined,
    });
    
    record.message_ids = [String(msg?.message_id || "unknown")];
    record.delivered_text_length = text.length;
    record.status = text.length === record.extracted_text_length ? "completed" : "truncated";
    record.completed_at = Date.now();
    
  } catch (e: any) {
    console.error("[delivery] single failed", e);
    record.status = "failed";
  }
  
  await appendDeliveryRecord(record);
  return record;
}

async function deliverChunks(
  ctx: any,
  record: DeliveryRecord,
  chunks: string[],
  options?: { title?: string; reply_to_message_id?: number }
): Promise<DeliveryRecord> {
  record.delivery_mode = "chunks";
  record.chunks_count = chunks.length;
  
  let totalDelivered = 0;
  
  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkNum = i + 1;
      const totalChunks = chunks.length;
      
      let chunkText = chunks[i];
      if (options?.title && i === 0) {
        chunkText = `${options.title}\n\nPart ${chunkNum}/${totalChunks}\n${chunkText}`;
      } else {
        chunkText = `Part ${chunkNum}/${totalChunks}\n${chunkText}`;
      }
      
      const msg = await ctx.reply(chunkText, {
        reply_to_message_id: i === 0 ? options?.reply_to_message_id : undefined,
        parse_mode: undefined,
      });
      
      record.message_ids.push(String(msg?.message_id || "unknown"));
      totalDelivered += chunks[i].length;
      record.delivered_text_length = totalDelivered;
      record.status = "chunk_sent";
      
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    record.status = totalDelivered >= record.extracted_text_length * 0.95 ? "completed" : "truncated";
    record.completed_at = Date.now();
    
  } catch (e: any) {
    console.error("[delivery] chunk failed at", record.chunks_count, e);
    record.status = "truncated";
    record.completed_at = Date.now();
  }
  
  await appendDeliveryRecord(record);
  return record;
}

async function deliverAsFile(
  ctx: any,
  record: DeliveryRecord,
  text: string,
  options?: { title?: string; language?: string; file_ext?: string; reply_to_message_id?: number }
): Promise<DeliveryRecord> {
  record.delivery_mode = "file";
  
  try {
    const ext = options?.file_ext || (options?.language === "markdown" ? "md" : "txt");
    const filename = `${options?.title || "response"}.${ext}`;
    const filePath = path.join(TELEGA_DIR, filename);
    
    let content = text;
    if (options?.title) {
      content = `# ${options.title}\n\n${text}`;
    }
    
    await fs.writeFile(filePath, content, "utf-8");
    
    await ctx.reply_with_document(
      { source: filePath },
      {
        caption: `📄 Full response (${text.length.toLocaleString()} chars)`,
        reply_to_message_id: options?.reply_to_message_id,
      }
    );
    
    record.file_path = filePath;
    record.delivered_text_length = text.length;
    record.status = "file_sent";
    record.completed_at = Date.now();
    
  } catch (e: any) {
    console.error("[delivery] file delivery failed", e);
    record.status = "failed";
  }
  
  await appendDeliveryRecord(record);
  return record;
}

function smartSplit(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  const paragraphs = text.split(/\n{2,}/);
  
  let currentChunk = "";
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      if (para.length <= maxChunkSize) {
        currentChunk = para;
      } else {
        const sentences = para.split(/(?<=[.!?])\s+/);
        currentChunk = "";
        
        for (const sent of sentences) {
          if (currentChunk.length + sent.length + 1 <= maxChunkSize) {
            currentChunk += (currentChunk ? " " : "") + sent;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            if (sent.length <= maxChunkSize) {
              currentChunk = sent;
            } else {
              for (let i = 0; i < sent.length; i += maxChunkSize) {
                chunks.push(sent.slice(i, i + maxChunkSize));
              }
              currentChunk = "";
            }
          }
        }
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks.filter(Boolean);
}

export function formatDeliveryRecord(record: DeliveryRecord): string {
  const statusEmoji: Record<DeliveryStatus, string> = {
    started: "⏳",
    chunk_sent: "📤",
    file_sent: "📄",
    completed: "✅",
    truncated: "⚠️",
    failed: "❌",
  };
  
  const modeLabels: Record<DeliveryMode, string> = {
    single: "Single message",
    chunks: `Chunks (${record.chunks_count})`,
    file: `File (${path.basename(record.file_path || "unknown")})`,
  };
  
  const lines = [
    `${statusEmoji[record.status]} Delivery Record`,
    `ID: ${record.delivery_id}`,
    `Mode: ${modeLabels[record.delivery_mode]}`,
    `Extracted: ${record.extracted_text_length.toLocaleString()} chars`,
    `Delivered: ${record.delivered_text_length.toLocaleString()} chars`,
    `Status: ${record.status}`,
  ];
  
  if (record.extracted_text_length !== record.delivered_text_length) {
    const pct = ((record.delivered_text_length / record.extracted_text_length) * 100).toFixed(1);
    lines.push(`⚠️ Delivery: ${pct}% of original`);
  }
  
  return lines.join("\n");
}

export async function loadDeliveryRecords(userId?: string, limit = 20): Promise<DeliveryRecord[]> {
  const records: DeliveryRecord[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(DELIVERY_LOG_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.delivery_id) {
          if (!userId || parsed.user_id === userId) {
            records.push(parsed);
          }
        }
      } catch {}
    }
  } catch {}
  return records.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}

export function isDeliveryComplete(record: DeliveryRecord): boolean {
  return record.status === "completed";
}

export function isDeliveryTruncated(record: DeliveryRecord): boolean {
  return record.status === "truncated" || record.delivered_text_length < record.extracted_text_length;
}