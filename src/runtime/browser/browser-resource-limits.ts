export interface ResourceLimits {
  maxSessions: number;
  maxPagesPerSession: number;
  maxConcurrentTasks: number;
  sessionIdleTimeoutMs: number;
  taskTimeoutMs: number;
  maxScreenshotsPerTask: number;
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxSessions: 4,
  maxPagesPerSession: 3,
  maxConcurrentTasks: 2,
  sessionIdleTimeoutMs: 300000,
  taskTimeoutMs: 120000,
  maxScreenshotsPerTask: 10,
};

let limits: ResourceLimits = { ...DEFAULT_LIMITS };
let usage: { activeSessions: number; totalTasksRun: number; totalErrors: number } = { activeSessions: 0, totalTasksRun: 0, totalErrors: 0 };

export function getResourceLimits(): ResourceLimits {
  return { ...limits };
}

export function setResourceLimits(overrides: Partial<ResourceLimits>): ResourceLimits {
  limits = { ...limits, ...overrides };
  return getResourceLimits();
}

export function resetResourceLimits(): ResourceLimits {
  limits = { ...DEFAULT_LIMITS };
  return getResourceLimits();
}

export function recordResourceUsage(delta: Partial<typeof usage>): void {
  usage = { ...usage, ...delta };
  if (delta.activeSessions !== undefined) usage.activeSessions = delta.activeSessions;
}

export function recordTaskRun(): void {
  usage.totalTasksRun++;
}

export function recordError(): void {
  usage.totalErrors++;
}

export function getResourceUsage(): typeof usage {
  return { ...usage };
}

export function resourceSummary(): string {
  return [
    `Resource limits: maxSessions=${limits.maxSessions}, maxConcurrent=${limits.maxConcurrentTasks}, idleTimeout=${(limits.sessionIdleTimeoutMs / 1000).toFixed(0)}s`,
    `Usage: activeSessions=${usage.activeSessions}, totalTasks=${usage.totalTasksRun}, errors=${usage.totalErrors}`,
  ].join("\n");
}
