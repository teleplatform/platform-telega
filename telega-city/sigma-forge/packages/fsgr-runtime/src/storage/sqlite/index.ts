import type Database from "better-sqlite3";
import { createRunsRepo } from "./runsRepo.js";
import { createNodesRepo } from "./nodesRepo.js";
import { createArtifactsRepo } from "./artifactsRepo.js";
import { createCapsulesRepo } from "./capsulesRepo.js";
import { createEventsRepo } from "./eventsRepo.js";
import { createMemoriesRepo } from "./memoriesRepo.js";
import { createReviewsRepo } from "./reviewsRepo.js";
import { createEvidenceRepo } from "./evidenceRepo.js";

export function createRepos(db: Database.Database) {
  return {
    runs: createRunsRepo(db),
    nodes: createNodesRepo(db),
    artifacts: createArtifactsRepo(db),
    capsules: createCapsulesRepo(db),
    events: createEventsRepo(db),
    memories: createMemoriesRepo(db),
    reviews: createReviewsRepo(db),
    evidence: createEvidenceRepo(db),
  };
}

export type Repos = ReturnType<typeof createRepos>;
