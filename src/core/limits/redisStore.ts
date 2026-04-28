import type { CounterStore, IncrResult } from "./limiterStore";

export class RedisCounterStore implements CounterStore {
  constructor(private redis: { eval: Function }) {}

  async incrWithTtl(key: string, ttlSeconds: number): Promise<IncrResult> {
    // Lua: INCR + set EXPIRE only when new
    const lua = `
      local v = redis.call("INCR", KEYS[1])
      if v == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
      local ttl = redis.call("TTL", KEYS[1])
      return {v, ttl}
    `;
    const res = await this.redis.eval(lua, 1, key, ttlSeconds);
    const value = Number(res[0]);
    const ttl = Number(res[1]);
    return { value, reset_s: ttl > 0 ? ttl : ttlSeconds };
  }

  async getTtl(key: string): Promise<number> {
    // if you expose ttl method in redis client
    // not mandatory for this pack
    return -1;
  }
}