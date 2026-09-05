import { SchedulerPersistence, type SchedulerRunRecord, type SchedulerWaveEventRecord } from "./scheduler-persistence.js";

let persistenceInstance: SchedulerPersistence | null = null;

export function setSchedulerRunStorePersistence(persistence: SchedulerPersistence): void {
  persistenceInstance = persistence;
}

export function getSchedulerRunStorePersistence(): SchedulerPersistence | null {
  return persistenceInstance;
}

export async function createSchedulerRun(
  run_id: string,
  group_id: string,
  status: string
): Promise<void> {
  if (!persistenceInstance) {
    throw new Error("Scheduler run store not initialized");
  }
  const record: SchedulerRunRecord = {
    run_id,
    group_id,
    status,
    waves_run: 0,
    tasks_dispatched: 0,
    tasks_completed: 0,
    tasks_failed: 0,
    tasks_blocked: 0,
    stopped_reason: "",
    started_at: new Date().toISOString(),
  };
  await persistenceInstance.persistRun(record);
}

export async function appendWaveEvent(
  run_id: string,
  wave_index: number,
  event_type: string,
  payload?: Record<string, unknown>
): Promise<void> {
  if (!persistenceInstance) {
    throw new Error("Scheduler run store not initialized");
  }
  const record: SchedulerWaveEventRecord = {
    event_id: `evt_${run_id}_${wave_index}_${event_type}`,
    run_id,
    wave_index,
    event_type,
    created_at: new Date().toISOString(),
    payload_json: payload ? JSON.stringify(payload) : undefined,
  };
  await persistenceInstance.persistWaveEvent(record);
}

export async function completeSchedulerRun(
  run_id: string,
  status: string,
  waves_run: number,
  tasks_dispatched: number,
  tasks_completed: number,
  tasks_failed: number,
  tasks_blocked: number,
  stopped_reason: string
): Promise<void> {
  if (!persistenceInstance) {
    throw new Error("Scheduler run store not initialized");
  }
  const stmt = persistenceInstance["db"].prepare(`
    UPDATE scheduler_runs SET
      status = ?,
      waves_run = ?,
      tasks_dispatched = ?,
      tasks_completed = ?,
      tasks_failed = ?,
      tasks_blocked = ?,
      stopped_reason = ?,
      completed_at = ?
    WHERE run_id = ?
  `);
  stmt.run(
    status,
    waves_run,
    tasks_dispatched,
    tasks_completed,
    tasks_failed,
    tasks_blocked,
    stopped_reason,
    new Date().toISOString(),
    run_id
  );
}

export async function getSchedulerRun(run_id: string): Promise<SchedulerRunRecord | null> {
  if (!persistenceInstance) {
    return null;
  }
  return persistenceInstance.getRun(run_id);
}

export async function listSchedulerWaveEvents(run_id: string): Promise<SchedulerWaveEventRecord[]> {
  if (!persistenceInstance) {
    return [];
  }
  return persistenceInstance.listWaveEvents(run_id);
}

export type GovernanceState = "running" | "paused" | "cancelled" | "needs_creator" | "pending_approval";

export async function getGovernanceState(run_id: string): Promise<GovernanceState | null> {
  if (!persistenceInstance) {
    return null;
  }
  const stmt = persistenceInstance["db"].prepare(`
    SELECT governance_state FROM scheduler_runs WHERE run_id = ?
  `);
  const row = stmt.get(run_id) as { governance_state?: string } | undefined;
  return (row?.governance_state as GovernanceState) ?? null;
}

export async function pauseSchedulerRun(run_id: string, reason?: string): Promise<void> {
  if (!persistenceInstance) {
    throw new Error("Scheduler run store not initialized");
  }
  const stmt = persistenceInstance["db"].prepare(`
    UPDATE scheduler_runs SET governance_state = ?, governance_reason = ? WHERE run_id = ?
  `);
  stmt.run("paused", reason ?? "paused", run_id);
}

export async function resumeSchedulerRun(run_id: string): Promise<void> {
  if (!persistenceInstance) {
    throw new Error("Scheduler run store not initialized");
  }
  const stmt = persistenceInstance["db"].prepare(`
    UPDATE scheduler_runs SET governance_state = 'running', governance_reason = NULL WHERE run_id = ?
  `);
  stmt.run(run_id);
}

export async function cancelSchedulerRun(run_id: string, reason?: string): Promise<void> {
  if (!persistenceInstance) {
    throw new Error("Scheduler run store not initialized");
  }
  const stmt = persistenceInstance["db"].prepare(`
    UPDATE scheduler_runs SET governance_state = ?, governance_reason = ? WHERE run_id = ?
  `);
  stmt.run("cancelled", reason ?? "cancelled", run_id);
}

export async function setNeedsCreator(run_id: string, reason?: string): Promise<void> {
  if (!persistenceInstance) {
    throw new Error("Scheduler run store not initialized");
  }
  const stmt = persistenceInstance["db"].prepare(`
    UPDATE scheduler_runs SET governance_state = ?, governance_reason = ? WHERE run_id = ?
  `);
  stmt.run("needs_creator", reason ?? "needs_creator", run_id);
}

export interface IncompleteSchedulerRun extends SchedulerRunRecord {
  incomplete_reason: "process_interrupted" | "unspecified";
}

export async function listIncompleteSchedulerRuns(): Promise<IncompleteSchedulerRun[]> {
  if (!persistenceInstance) {
    return [];
  }
  const stmt = persistenceInstance["db"].prepare(`
    SELECT * FROM scheduler_runs
    WHERE status = 'running' AND completed_at IS NULL
    ORDER BY started_at DESC
  `);
  const rows = stmt.all() as SchedulerRunRecord[];
  return rows.map(r => ({
    ...r,
    incomplete_reason: "process_interrupted",
  }));
}

export async function clearSchedulerGovernance(run_id: string): Promise<void> {
  if (!persistenceInstance) {
    throw new Error("Scheduler run store not initialized");
  }
  const stmt = persistenceInstance["db"].prepare(`
    UPDATE scheduler_runs SET governance_state = 'running', governance_reason = NULL WHERE run_id = ?
  `);
  stmt.run(run_id);
}

export interface SchedulerRunSummary {
  run_id: string;
  group_id: string;
  status: string;
  waves_run: number;
  tasks_dispatched: number;
  started_at: string;
  completed_at?: string;
  governance_state?: string;
}

export async function listRunsByGovernanceState(
  states: ("running" | "paused" | "cancelled" | "needs_creator")[]
): Promise<SchedulerRunSummary[]> {
  if (!persistenceInstance) {
    return [];
  }
  const placeholders = states.map(() => "?").join(",");
  const stmt = persistenceInstance["db"].prepare(`
    SELECT run_id, group_id, status, waves_run, tasks_dispatched, started_at, completed_at, governance_state
    FROM scheduler_runs
    WHERE governance_state IN (${placeholders}) AND completed_at IS NULL
    ORDER BY started_at DESC
  `);
  const rows = stmt.all(...states) as SchedulerRunSummary[];
  return rows;
}

export async function listRecentCompletedRuns(limit: number = 10): Promise<SchedulerRunSummary[]> {
  if (!persistenceInstance) {
    return [];
  }
  const stmt = persistenceInstance["db"].prepare(`
    SELECT run_id, group_id, status, waves_run, tasks_dispatched, started_at, completed_at, governance_state
    FROM scheduler_runs
    WHERE completed_at IS NOT NULL
    ORDER BY completed_at DESC
    LIMIT ?
  `);
  const rows = stmt.all(limit) as SchedulerRunSummary[];
  return rows;
}

let lastRecoveryScanAt: string | null = null;

export function setLastRecoveryScan(timestamp: string): void {
  lastRecoveryScanAt = timestamp;
}

export function getLastRecoveryScan(): string | null {
  return lastRecoveryScanAt;
}