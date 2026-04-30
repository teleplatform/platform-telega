import type Database from "better-sqlite3";

export function createEventsRepo(db: Database.Database) {
  return {
    appendEvent(event: { event_id: string; run_id: string; node_id?: string; event_type: string; payload_json: string }): void {
      db.prepare(
        `INSERT INTO fsgr_events (event_id, run_id, node_id, event_type, payload_json, created_at)
         VALUES (@event_id, @run_id, @node_id, @event_type, @payload_json, @created_at)`
      ).run({
        event_id: event.event_id,
        run_id: event.run_id,
        node_id: event.node_id ?? null,
        event_type: event.event_type,
        payload_json: event.payload_json,
        created_at: new Date().toISOString(),
      });
    },

    getEventsByRunId(run_id: string): any[] {
      return db.prepare("SELECT * FROM fsgr_events WHERE run_id = ? ORDER BY created_at ASC").all(run_id);
    },

    getEventsByRunIdAndType(run_id: string, event_type: string): any[] {
      return db.prepare("SELECT * FROM fsgr_events WHERE run_id = ? AND event_type = ? ORDER BY created_at ASC").all(run_id, event_type);
    },
  };
}
