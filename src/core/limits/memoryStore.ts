import type { CounterStore, IncrResult } from "./limiterStore.js";

type Entry = { value: number; expiresAt: number };

export class MemoryCounterStore implements CounterStore {
  private map = new Map<string, Entry>();

  async incrWithTtl(key: string, ttlSeconds: number): Promise<IncrResult> {
    const now = Date.now();
    const e = this.map.get(key);
    if (!e || e.expiresAt <= now) {
      const expiresAt = now + ttlSeconds * 1000;
      this.map.set(key, { value: 1, expiresAt });
      return { value: 1, reset_s: ttlSeconds };
    }
    e.value += 1;
    return { value: e.value, reset_s: Math.max(1, Math.ceil((e.expiresAt - now) / 1000)) };
  }

  async getTtl(key: string): Promise<number> {
    const e = this.map.get(key);
    if (!e) return -1;
    const now = Date.now();
    if (e.expiresAt <= now) return -1;
    return Math.max(1, Math.ceil((e.expiresAt - now) / 1000));
  }
}