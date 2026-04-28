/**
 * Runtime Bootstrap — X2.4
 *
 * Wires together: repos → events → services → orchestrator → read models
 */

import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { GovernanceRepos, type SqliteLikeDb } from "./repos/governanceRepos.js";
import { GovernanceEventWriter } from "./events/governanceEventWriter.js";
import {
  GovernanceService,
  ConstitutionOrchestrator,
  OversightCoordinator,
  GovernanceReadModels,
} from "./services/governanceServices.js";

// ============================================================================
// Migration application
// ============================================================================

function applyMigrations(db: Database.Database, migrationsDir: string): void {
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    db.exec(sql);
    console.log(`[governance-runtime] Applied migration: ${file}`);
  }
}

// ============================================================================
// Runtime creation
// ============================================================================

export interface GovernanceRuntimeDeps {
  dbPath: string;
  migrationsDir: string;
}

export interface GovernanceRuntime {
  repos: GovernanceRepos;
  events: GovernanceEventWriter;
  governanceService: GovernanceService;
  orchestrator: ConstitutionOrchestrator;
  oversight: OversightCoordinator;
  readModels: GovernanceReadModels;
  db: Database.Database;
}

export function createGovernanceRuntime(
  deps: GovernanceRuntimeDeps,
): GovernanceRuntime {
  // Ensure directory exists
  const dbDir = path.dirname(deps.dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  // Open SQLite database
  const db = new Database(deps.dbPath);

  // Enable WAL mode for better concurrency
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Apply migrations
  applyMigrations(db, deps.migrationsDir);

  // Create repositories
  const repos = new GovernanceRepos(db as unknown as SqliteLikeDb);

  // Create event writer
  const events = new GovernanceEventWriter({ repos });

  // Create services
  const governanceService = new GovernanceService(repos, events);
  const orchestrator = new ConstitutionOrchestrator(repos, events);
  const oversight = new OversightCoordinator(repos, events);
  const readModels = new GovernanceReadModels(repos);

  console.log("[governance-runtime] Runtime initialized successfully");

  return {
    repos,
    events,
    governanceService,
    orchestrator,
    oversight,
    readModels,
    db,
  };
}

// ============================================================================
// Default runtime (uses env or defaults)
// ============================================================================

const DEFAULT_DB_PATH = process.env.TELEGPT_GOVERNANCE_DB ?? ".telegpt/governance.db";
const DEFAULT_MIGRATIONS_DIR =
  process.env.TELEGPT_GOVERNANCE_MIGRATIONS ?? "db/migrations";

export function createDefaultRuntime(): GovernanceRuntime {
  return createGovernanceRuntime({
    dbPath: DEFAULT_DB_PATH,
    migrationsDir: DEFAULT_MIGRATIONS_DIR,
  });
}

// ============================================================================
// Singleton (for use in server routes)
// ============================================================================

let _runtime: GovernanceRuntime | null = null;

export function getGovernanceRuntime(): GovernanceRuntime {
  if (!_runtime) {
    _runtime = createDefaultRuntime();
  }
  return _runtime;
}

export function setGovernanceRuntimeForTest(runtime: GovernanceRuntime | null): void {
  _runtime = runtime;
}
