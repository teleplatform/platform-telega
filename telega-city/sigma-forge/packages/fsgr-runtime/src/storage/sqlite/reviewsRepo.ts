import type Database from "better-sqlite3";
import type { ReviewVerdict, ReviewRole } from "../../fsgr-contracts/src/index.js";

function parseReview(row: any): ReviewVerdict {
  return {
    ...row,
    findings: JSON.parse(row.findings_json || "[]"),
    related_artifact_ids: JSON.parse(row.related_artifact_ids_json || "[]"),
  };
}

export function createReviewsRepo(db: Database.Database) {
  return {
    saveReview(verdict: ReviewVerdict): void {
      db.prepare(
        `INSERT OR REPLACE INTO fsgr_reviews (review_id, run_id, node_id, role, status, summary, findings_json, related_artifact_ids_json, created_at)
         VALUES (@review_id, @run_id, @node_id, @role, @status, @summary, @findings_json, @related_artifact_ids_json, @created_at)`
      ).run({
        review_id: verdict.review_id,
        run_id: verdict.run_id,
        node_id: verdict.node_id ?? null,
        role: verdict.role,
        status: verdict.status,
        summary: verdict.summary,
        findings_json: JSON.stringify(verdict.findings),
        related_artifact_ids_json: JSON.stringify(verdict.related_artifact_ids),
        created_at: verdict.created_at,
      });
    },

    listReviewsByRun(run_id: string): ReviewVerdict[] {
      const rows = db.prepare("SELECT * FROM fsgr_reviews WHERE run_id = ? ORDER BY created_at DESC").all(run_id);
      return rows.map(parseReview);
    },

    listReviewsByNode(run_id: string, node_id: string): ReviewVerdict[] {
      const rows = db.prepare("SELECT * FROM fsgr_reviews WHERE run_id = ? AND node_id = ? ORDER BY created_at DESC").all(run_id, node_id);
      return rows.map(parseReview);
    },

    getLatestReviewByRole(run_id: string, node_id: string | undefined, role: ReviewRole): ReviewVerdict | null {
      const rows = db.prepare(
        "SELECT * FROM fsgr_reviews WHERE run_id = ? AND role = ? AND (node_id = ? OR (? IS NULL AND node_id IS NULL)) ORDER BY created_at DESC LIMIT 1"
      ).all(run_id, role, node_id ?? null, node_id ?? null);
      return rows.length > 0 ? parseReview(rows[0]) : null;
    },
  };
}
