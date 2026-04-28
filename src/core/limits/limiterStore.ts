export type IncrResult = { value: number; reset_s: number };

export interface CounterStore {
  incrWithTtl(key: string, ttlSeconds: number): Promise<IncrResult>;
  getTtl(key: string): Promise<number>; // seconds
}