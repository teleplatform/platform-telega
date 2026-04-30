import type Database from "better-sqlite3";
import type { RunLedger } from "../../../fsgr-contracts/src/index.js";
import type { LedgerEvent, LedgerEventType } from "../ledger/ledgerEvents.js";
import { createRepos, type Repos } from "../storage/sqlite/index.js";
import { randomUUID } from "crypto";

export interface LedgerStoreDeps {
  repos: Repos;
}

export function createLedgerStore(deps: LedgerStoreDeps) {
  const { repos } = deps;

  return {
    createRun(run: RunLedger): void {
      repos.runs.createRun(run);
    },

    updateRun(run_id: string, patch: Partial<RunLedger>): void {
      repos.runs.updateRun(run_id, patch);
    },

    getRun(run_id: string): RunLedger | null {
      const run = repos.runs.getRunById(run_id);
      if (!run) return null;

      const nodes = repos.nodes.getNodesByRunId(run_id);
      const artifacts = repos.artifacts.getArtifactsByRunId(run_id);

      run.completed_node_ids = nodes.filter((n: any) => n.status === "completed").map((n: any) => n.node_id);
      run.failed_node_ids = nodes.filter((n: any) => n.status === "failed").map((n: any) => n.node_id);
      run.current_node_ids = nodes.filter((n: any) => n.status === "running").map((n: any) => n.node_id);
      run.artifact_ids = artifacts.map((a: any) => a.artifact_id);

      return run;
    },

    appendEvent(event: Omit<LedgerEvent, "event_id" | "created_at">): void {
      repos.events.appendEvent({
        event_id: `evt_${randomUUID()}`,
        run_id: event.run_id,
        node_id: event.node_id,
        event_type: event.event_type,
        payload_json: JSON.stringify(event.payload),
      });
    },

    getEvents(run_id: string): LedgerEvent[] {
      const rows = repos.events.getEventsByRunId(run_id);
      return rows.map((row: any) => ({
        event_id: row.event_id,
        run_id: row.run_id,
        node_id: row.node_id,
        event_type: row.event_type as LedgerEventType,
        payload: JSON.parse(row.payload_json),
        created_at: row.created_at,
      }));
    },

    getNodes(run_id: string): any[] {
      return repos.nodes.getNodesByRunId(run_id);
    },

    updateNode(node_id: string, patch: Record<string, any>): void {
      repos.nodes.updateNode(node_id, patch);
    },

    saveCapsule(capsule: { capsule_id: string; run_id: string; capsule_json: string }): void {
      repos.capsules.saveCapsule(capsule);
    },

    getCapsule(run_id: string): any {
      return repos.capsules.getCapsuleByRunId(run_id);
    },

    createArtifact(artifact: { artifact_id: string; run_id: string; node_id?: string; artifact_kind: string; title: string; storage_ref: string; checksum?: string; validator_results: any[] }): void {
      repos.artifacts.createArtifact(artifact);
    },
  };
}

export type LedgerStore = ReturnType<typeof createLedgerStore>;
