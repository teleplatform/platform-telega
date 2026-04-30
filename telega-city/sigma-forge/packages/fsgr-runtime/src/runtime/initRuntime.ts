import type Database from "better-sqlite3";
import { initSqliteFsgrDb } from "../storage/sqlite/db.js";
import { createRepos, type Repos } from "../storage/sqlite/index.js";
import { createLedgerStore, type LedgerStore } from "../ledger/ledgerStore.js";
import { createSkillRegistry, type SkillRegistry } from "../skills/registry.js";
import { createExecutionHandlerRegistry, createDefaultExecutionHandler, type ExecutionHandlerRegistry } from "../execution/handlers.js";
import { createValidatorRegistry, registerDefaultValidators, type ValidatorRegistry } from "../execution/validators.js";
import { registerCoreSkills, CORE_SKILLS } from "../../../fsgr-skills-core/src/index.js";
import { createMemoryStore, type MemoryStore } from "../memory/memoryStore.js";
import { createReviewRegistry, registerDefaultReviewers, type ReviewRegistry } from "../review/reviewRegistry.js";
import type { BenchmarkReport } from "../benchmarks/benchmarkTypes.js";

export interface FsgrRuntime {
  db: Database.Database;
  repos: Repos;
  ledgerStore: LedgerStore;
  skillRegistry: SkillRegistry;
  handlerRegistry: ExecutionHandlerRegistry;
  validatorRegistry: ValidatorRegistry;
  memoryStore: MemoryStore;
  reviewRegistry: ReviewRegistry;
  lastBenchmarkReport?: BenchmarkReport;
}

export interface FsgrRuntimeOptions {
  dbPath?: string;
}

export function initFsgrRuntime(options?: FsgrRuntimeOptions): FsgrRuntime {
  const db = initSqliteFsgrDb(options?.dbPath);
  const repos = createRepos(db);
  const ledgerStore = createLedgerStore({ repos });
  const skillRegistry = createSkillRegistry();
  const defaultHandler = createDefaultExecutionHandler();
  const handlerRegistry = createExecutionHandlerRegistry(defaultHandler);
  const validatorRegistry = createValidatorRegistry();
  const memoryStore = createMemoryStore({ memoriesRepo: repos.memories });
  const reviewRegistry = createReviewRegistry();

  registerCoreSkills(skillRegistry);
  registerDefaultValidators(validatorRegistry);
  registerDefaultReviewers(reviewRegistry);

  return { db, repos, ledgerStore, skillRegistry, handlerRegistry, validatorRegistry, memoryStore, reviewRegistry };
}
