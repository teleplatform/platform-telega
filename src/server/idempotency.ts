type Done = { kind: "done"; body: any; statusCode: number; expiresAt: number };
type Inflight = { kind: "inflight"; p: Promise<Done>; expiresAt: number };
type Entry = Done | Inflight;

const TTL_DONE_MS = Math.max(
  1_000,
  Number(process.env.IDEMPO_TTL_DONE_MS ?? String(24 * 60 * 60 * 1000)) ||
    24 * 60 * 60 * 1000
);
const TTL_INFLIGHT_MS = Math.max(
  1_000,
  Number(process.env.IDEMPO_TTL_INFLIGHT_MS ?? String(60 * 1000)) || 60 * 1000
);
const MAX_ENTRIES = Math.max(
  100,
  Number(process.env.IDEMPO_MAX_ENTRIES ?? "5000") || 5000
);

const store = new Map<string, Entry>();
let reqCount = 0;
let hitCount = 0;
let missCount = 0;
const LOG_EVERY = Math.max(
  1,
  Number(process.env.IDEMPO_LOG_EVERY ?? "200") || 200
);

function now() {
  return Date.now();
}

function gc() {
  const t = now();
  for (const [k, v] of store) {
    if (v.expiresAt <= t) store.delete(k);
  }
  while (store.size > MAX_ENTRIES) {
    const first = store.keys().next().value as string | undefined;
    if (!first) break;
    store.delete(first);
  }
}

export async function idempoHandle(
  requestId: string | undefined,
  exec: () => Promise<{ body: any; statusCode?: number }>
): Promise<{ body: any; statusCode: number; usedCache: boolean }> {
  gc();
  reqCount++;
  if (reqCount % LOG_EVERY === 0) {
    let inflight = 0;
    let done = 0;
    for (const v of store.values()) v.kind === "inflight" ? inflight++ : done++;
    const total = hitCount + missCount;
    const hitRate = total ? Math.round((hitCount / total) * 100) : 0;
    console.info(
      `[idempo] size=${store.size} inflight=${inflight} done=${done} hit=${hitCount} miss=${missCount} hitRate=${hitRate}%`
    );
  }

  if (!requestId) {
    const r = await exec();
    return { body: r.body, statusCode: r.statusCode ?? 200, usedCache: false };
  }

  const hit = store.get(requestId);
  if (hit && hit.expiresAt > now()) {
    if (hit.kind === "done") {
      hitCount++;
      return { body: hit.body, statusCode: hit.statusCode, usedCache: true };
    }
    const done = await hit.p;
    hitCount++;
    return { body: done.body, statusCode: done.statusCode, usedCache: true };
  }

  missCount++;
  const inflightExpiresAt = now() + TTL_INFLIGHT_MS;
  const doneExpiresAt = now() + TTL_DONE_MS;
  const p = (async (): Promise<Done> => {
    try {
      const r = await exec();
      const done: Done = {
        kind: "done",
        body: r.body,
        statusCode: r.statusCode ?? 200,
        expiresAt: doneExpiresAt,
      };
      store.set(requestId, done);
      return done;
    } catch (e) {
      store.delete(requestId);
      throw e;
    }
  })();

  store.set(requestId, { kind: "inflight", p, expiresAt: inflightExpiresAt });

  const done = await p;
  return { body: done.body, statusCode: done.statusCode, usedCache: false };
}

export function idempoStats() {
  return {
    size: store.size,
    reqCount,
    hitCount,
    missCount,
    logEvery: LOG_EVERY,
  };
}
