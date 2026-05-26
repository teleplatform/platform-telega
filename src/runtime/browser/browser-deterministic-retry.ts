export interface RetryOptions {
  label: string;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
  const jitter = Math.random() * delay * 0.1;
  return Math.round(delay + jitter);
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e));

      if (attempt < opts.maxRetries) {
        const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error(`Retry failed for ${opts.label}`);
}
