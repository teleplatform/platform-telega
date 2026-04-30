import type Database from "better-sqlite3";

function parseNode(row: any): any {
  return {
    ...row,
    dependency_ids: JSON.parse(row.dependency_ids_json || "[]"),
    input_refs: JSON.parse(row.input_refs_json || "[]"),
    output_refs: JSON.parse(row.output_refs_json || "[]"),
    validator_hooks: JSON.parse(row.validator_hooks_json || "[]"),
  };
}

export function createNodesRepo(db: Database.Database) {
  return {
    createNodes(nodes: Array<{ node_id: string; run_id: string; skill_id: string; title: string; status: string; dependency_ids: string[]; input_refs: string[]; output_refs: string[]; validator_hooks: string[]; retry_count: number; max_retries: number; fallback_skill_id?: string; risk_class: string }>): void {
      const stmt = db.prepare(
        `INSERT INTO fsgr_nodes (node_id, run_id, skill_id, title, status, dependency_ids_json, input_refs_json, output_refs_json, retry_count, max_retries, fallback_skill_id, risk_class, validator_hooks_json, updated_at)
         VALUES (@node_id, @run_id, @skill_id, @title, @status, @dependency_ids_json, @input_refs_json, @output_refs_json, @retry_count, @max_retries, @fallback_skill_id, @risk_class, @validator_hooks_json, @updated_at)`
      );
      const insertMany = db.transaction((nodesList: typeof nodes) => {
        for (const node of nodesList) {
          stmt.run({
            node_id: node.node_id,
            run_id: node.run_id,
            skill_id: node.skill_id,
            title: node.title,
            status: node.status,
            dependency_ids_json: JSON.stringify(node.dependency_ids),
            input_refs_json: JSON.stringify(node.input_refs),
            output_refs_json: JSON.stringify(node.output_refs),
            retry_count: node.retry_count,
            max_retries: node.max_retries,
            fallback_skill_id: node.fallback_skill_id ?? null,
            risk_class: node.risk_class,
            validator_hooks_json: JSON.stringify(node.validator_hooks),
            updated_at: new Date().toISOString(),
          });
        }
      });
      insertMany(nodes);
    },

    getNodesByRunId(run_id: string): any[] {
      const rows = db.prepare("SELECT * FROM fsgr_nodes WHERE run_id = ?").all(run_id);
      return rows.map(parseNode);
    },

    getNodeById(node_id: string): any {
      const row = db.prepare("SELECT * FROM fsgr_nodes WHERE node_id = ?").get(node_id);
      return row ? parseNode(row) : undefined;
    },

    updateNode(node_id: string, patch: Record<string, any>): void {
      const fields: string[] = [];
      const params: Record<string, any> = { node_id };
      for (const [key, value] of Object.entries(patch)) {
        if (key === "node_id") continue;
        const dbKey = key === "dependency_ids" ? "dependency_ids_json" : key === "input_refs" ? "input_refs_json" : key === "output_refs" ? "output_refs_json" : key === "validator_hooks" ? "validator_hooks_json" : key;
        fields.push(`${dbKey} = @${dbKey}`);
        params[dbKey] = Array.isArray(value) ? JSON.stringify(value) : value;
      }
      if (fields.length === 0) return;
      fields.push("updated_at = @updated_at");
      params.updated_at = new Date().toISOString();
      db.prepare(`UPDATE fsgr_nodes SET ${fields.join(", ")} WHERE node_id = @node_id`).run(params);
    },

    listReadyNodes(run_id: string): any[] {
      const rows = db.prepare("SELECT * FROM fsgr_nodes WHERE run_id = ? AND status = 'ready'").all(run_id);
      return rows.map(parseNode);
    },
  };
}
