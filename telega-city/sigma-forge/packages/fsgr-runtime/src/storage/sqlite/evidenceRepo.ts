import type Database from "better-sqlite3";

export interface EvidenceLink {
  link_id: string;
  run_id: string;
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  relation: string;
  created_at: string;
}

export function createEvidenceRepo(db: Database.Database) {
  return {
    appendEvidenceLink(link: EvidenceLink): void {
      db.prepare(
        `INSERT OR REPLACE INTO fsgr_evidence_links (link_id, run_id, from_kind, from_id, to_kind, to_id, relation, created_at)
         VALUES (@link_id, @run_id, @from_kind, @from_id, @to_kind, @to_id, @relation, @created_at)`
      ).run({
        link_id: link.link_id,
        run_id: link.run_id,
        from_kind: link.from_kind,
        from_id: link.from_id,
        to_kind: link.to_kind,
        to_id: link.to_id,
        relation: link.relation,
        created_at: link.created_at,
      });
    },

    listEvidenceLinksByRun(run_id: string): EvidenceLink[] {
      return db.prepare("SELECT * FROM fsgr_evidence_links WHERE run_id = ? ORDER BY created_at DESC").all(run_id) as EvidenceLink[];
    },

    listEvidenceLinksByArtifact(artifact_id: string): EvidenceLink[] {
      return db.prepare("SELECT * FROM fsgr_evidence_links WHERE from_id = ? OR to_id = ?").all(artifact_id, artifact_id) as EvidenceLink[];
    },
  };
}
