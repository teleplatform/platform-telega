/**
 * @tele-gpt/dispatcher-core — Shared SQLite row-mapping helpers.
 */

/** Detect SQLite UNIQUE/PRIMARY KEY constraint violations (deterministic). */
export function isUniqueConstraintError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code ?? "";
    return code.startsWith("SQLITE_CONSTRAINT");
  }
  return false;
}

/** Parse a JSON column with a safe fallback. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * ISO timestamp strictly greater than `previous`, or now if now is already
 * after it. Guarantees monotonic advancement of updated_at / updatedAt even
 * when create + update happen within the same millisecond, keeping
 * timestamp-ordering assertions deterministic.
 */
export function nextIso(previous: string): string {
  const base = Date.parse(previous);
  if (!Number.isFinite(base)) return nowIso();
  const now = nowIso();
  if (Date.parse(now) > base) return now;
  return new Date(base + 1).toISOString();
}