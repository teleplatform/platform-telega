import Database from "better-sqlite3";

export interface SchedulerRunRecord {
  run_id: string;
  group_id: string;
  status: string;
  waves_run: number;
  tasks_dispatched: number;
  tasks_completed: number;
  tasks_failed: number;
  tasks_blocked: number;
  stopped_reason: string;
  started_at: string;
  completed_at?: string;
  governance_state?: "running" | "paused" | "cancelled" | "needs_creator";
  governance_reason?: string;
}

export interface SchedulerWaveEventRecord {
  event_id: string;
  run_id: string;
  wave_index: number;
  event_type: string;
  created_at: string;
  payload_json?: string;
}

export class SchedulerPersistence {
  constructor(private db: Database.Database) {}

  initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduler_runs (
        run_id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        status TEXT NOT NULL,
        waves_run INTEGER NOT NULL,
        tasks_dispatched INTEGER NOT NULL,
        tasks_completed INTEGER NOT NULL,
        tasks_failed INTEGER NOT NULL,
        tasks_blocked INTEGER NOT NULL,
        stopped_reason TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        governance_state TEXT DEFAULT 'running',
        governance_reason TEXT
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduler_wave_events (
        event_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        wave_index INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT,
        FOREIGN KEY(run_id) REFERENCES scheduler_runs(run_id) ON DELETE CASCADE
      );
    `);
  }

async persistRun(run: SchedulerRunRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO scheduler_runs (
        run_id, group_id, status, waves_run, tasks_dispatched,
        tasks_completed, tasks_failed, tasks_blocked, stopped_reason,
        started_at, completed_at, governance_state, governance_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      run.run_id,
      run.group_id,
      run.status,
      run.waves_run,
      run.tasks_dispatched,
      run.tasks_completed,
      run.tasks_failed,
      run.tasks_blocked,
      run.stopped_reason,
      run.started_at,
      run.completed_at ?? null,
      run.governance_state ?? "running",
      run.governance_reason ?? null
    );
  }

  async persistWaveEvent(event: SchedulerWaveEventRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO scheduler_wave_events (
        event_id, run_id, wave_index, event_type, created_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.event_id,
      event.run_id,
      event.wave_index,
      event.event_type,
      event.created_at,
      event.payload_json ?? null
    );
  }

  async getRun(run_id: string): Promise<SchedulerRunRecord | null> {
    const stmt = this.db.prepare(`SELECT * FROM scheduler_runs WHERE run_id = ?`);
    const row = stmt.get(run_id) as SchedulerRunRecord | undefined;
    return row ?? null;
  }

  async listRuns(group_id: string): Promise<SchedulerRunRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduler_runs WHERE group_id = ? ORDER BY started_at DESC
    `);
    const rows = stmt.all(group_id) as SchedulerRunRecord[];
    return rows;
  }

  async listWaveEvents(run_id: string): Promise<SchedulerWaveEventRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduler_wave_events WHERE run_id = ? ORDER BY wave_index ASC
    `);
    const rows = stmt.all(run_id) as SchedulerWaveEventRecord[];
    return rows;
  }

  async clear(): Promise<void> {
    this.db.exec(`DELETE FROM scheduler_wave_events`);
    this.db.exec(`DELETE FROM scheduler_runs`);
  }
}