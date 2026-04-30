import type Database from "better-sqlite3";

export function createCapsulesRepo(db: Database.Database) {
  return {
    saveCapsule(capsule: { capsule_id: string; run_id: string; capsule_json: string }): void {
      db.prepare(
        `INSERT OR REPLACE INTO fsgr_capsules (capsule_id, run_id, capsule_json, updated_at)
         VALUES (@capsule_id, @run_id, @capsule_json, @updated_at)`
      ).run({
        capsule_id: capsule.capsule_id,
        run_id: capsule.run_id,
        capsule_json: capsule.capsule_json,
        updated_at: new Date().toISOString(),
      });
    },

    getCapsuleByRunId(run_id: string): any {
      return db.prepare("SELECT * FROM fsgr_capsules WHERE run_id = ?").get(run_id);
    },
  };
}
