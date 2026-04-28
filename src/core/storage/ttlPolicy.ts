// TTL Policy - Storage & Retention v1
// Defines TTL rules for different types of data

export type TtlPolicy = {
  jobs: JobTtlPolicy;
  traces: number; // seconds
  artifacts: ArtifactTtlPolicy;
};

export type JobTtlPolicy = {
  completed: number; // seconds (7 days)
  failed: number;    // seconds (7 days)
  cancelled: number; // seconds (3 days)
  running: null;     // no TTL (managed by orphan rules)
};

export type ArtifactTtlPolicy = {
  temporary: number; // seconds (24-72 hours)
  evidence: number;  // seconds (infinite, or very long)
};

// Default TTL policy
export const DEFAULT_TTL_POLICY: TtlPolicy = {
  jobs: {
    completed: 7 * 24 * 60 * 60, // 7 days
    failed: 7 * 24 * 60 * 60,    // 7 days
    cancelled: 3 * 24 * 60 * 60, // 3 days
    running: null,                // no TTL
  },
  traces: 30 * 24 * 60 * 60,     // 30 days
  artifacts: {
    temporary: 48 * 60 * 60,     // 48 hours
    evidence: 365 * 24 * 60 * 60, // 1 year (effectively infinite)
  },
};

// Check if an item has expired based on its TTL
export function isExpired(
  createdAt: Date,
  ttlSeconds: number | null,
  now: Date = new Date()
): boolean {
  if (ttlSeconds === null) {
    return false; // No TTL means never expires
  }
  
  const ageSeconds = (now.getTime() - createdAt.getTime()) / 1000;
  return ageSeconds >= ttlSeconds;
}