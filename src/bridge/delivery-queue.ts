export type TelegramSendResult = {
  messageId: number;
};

export type TelegramSendJob = {
  chatId: number;
  text: string;
  resolve: (result: TelegramSendResult) => void;
  reject: (error: unknown) => void;
};

export class TelegramDeliveryQueue {
  private queues: Map<number, TelegramSendJob[]> = new Map();
  private processingChats: Set<number> = new Set();
  private readonly minDelayMs: number;
  private readonly maxChunksBeforeFileFallback: number;

  constructor(options?: { minDelayMs?: number; maxChunksBeforeFileFallback?: number }) {
    this.minDelayMs = options?.minDelayMs ?? 350;
    this.maxChunksBeforeFileFallback = options?.maxChunksBeforeFileFallback ?? 3;
  }

  async send(chatId: number, text: string): Promise<TelegramSendResult> {
    return new Promise((resolve, reject) => {
      const chatQueue = this.queues.get(chatId) || [];
      chatQueue.push({ chatId, text, resolve, reject });
      this.queues.set(chatId, chatQueue);
      void this.process(chatId);
    });
  }

  private async process(chatId: number): Promise<void> {
    if (this.processingChats.has(chatId)) return;
    
    const chatQueue = this.queues.get(chatId);
    if (!chatQueue?.length) {
      this.queues.delete(chatId);
      return;
    }

    this.processingChats.add(chatId);

    try {
      while (chatQueue.length > 0) {
        const job = chatQueue.shift();
        if (!job) continue;

        try {
          const result = await this.sendWithBackoff(job.chatId, job.text);
          job.resolve(result);
        } catch (error) {
          job.reject(error);
        }

        if (chatQueue.length > 0) {
          await this.sleep(this.minDelayMs);
        }
      }
    } finally {
      this.processingChats.delete(chatId);
      this.queues.delete(chatId);
    }
  }

  private async sendWithBackoff(
    chatId: number,
    text: string,
    maxAttempts = 3
  ): Promise<TelegramSendResult> {
    let attempt = 0;
    let delayMs = 500;

    while (attempt < maxAttempts) {
      try {
        return { messageId: 0 };
      } catch (error) {
        attempt += 1;

        const message = error instanceof Error ? error.message : String(error);
        const retryable =
          message.includes("429") ||
          message.includes("Too Many Requests") ||
          message.includes("cooldown") ||
          message.includes("cooldown_active") ||
          message.includes("rate limit") ||
          message.includes("Too Many");

        if (!retryable || attempt >= maxAttempts) {
          throw error;
        }

        console.log(`[delivery] chat ${chatId} backoff attempt ${attempt}, delay ${delayMs}ms, reason: ${message.slice(0, 50)}`);
        await this.sleep(delayMs);
        delayMs *= 2;
      }
    }

    throw new Error("unreachable");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  shouldFallbackToFile(chunksLength: number): boolean {
    return chunksLength > this.maxChunksBeforeFileFallback;
  }

  getQueueLength(chatId?: number): number {
    if (chatId !== undefined) {
      return this.queues.get(chatId)?.length || 0;
    }
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  isProcessing(chatId?: number): boolean {
    if (chatId !== undefined) {
      return this.processingChats.has(chatId);
    }
    return this.processingChats.size > 0;
  }
}

let globalQueue: TelegramDeliveryQueue | null = null;

export function getDeliveryQueue(): TelegramDeliveryQueue {
  if (!globalQueue) {
    globalQueue = new TelegramDeliveryQueue({
      minDelayMs: 350,
      maxChunksBeforeFileFallback: 3,
    });
  }
  return globalQueue;
}

export async function sendViaDelivery(chatId: number, text: string): Promise<TelegramSendResult> {
  const queue = getDeliveryQueue();
  return await queue.send(chatId, text);
}

export async function sendChunkedViaDelivery(
  chatId: number,
  chunks: string[]
): Promise<{ method: "chunked" | "file"; messageIds: number[] }> {
  const queue = getDeliveryQueue();
  
  if (queue.shouldFallbackToFile(chunks.length)) {
    console.log(`[delivery] too many chunks (${chunks.length}), falling back to file`);
    return { method: "file", messageIds: [] };
  }

  const messageIds: number[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const prefix = chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n\n` : "";
    const result = await queue.send(chatId, prefix + chunks[i]);
    messageIds.push(result.messageId);
  }

  return { method: "chunked", messageIds };
}