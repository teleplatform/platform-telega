import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function initSqliteFsgrDb(dbPath: string = ":memory:"): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyFsgrSchema(db);
  return db;
}

export function applyFsgrSchema(db: Database.Database): void {
  const schemaPath = join(__dirname, "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
}
