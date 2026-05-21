import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllDoctrines, type DoctrineEntry } from "./runtime-doctrine-registry.js";
import { checkFileOperationGovernance } from "../hooks/file-operation-governance-hook.js";
import { checkEvolutionProposalGovernance } from "../hooks/evolution-proposal-governance-hook.js";

export interface PolicyDraft {
  draft_id: string;
  doctrine_id: string;
  doctrine_title: string;
  file_path: string;
  content: string;
  created_at: string;
}

const POLICIES_DIR = path.join(process.cwd(), ".sigma", "policies");
let draftCounter = 0;

export async function compileDoctrineToPolicy(doctrine: DoctrineEntry): Promise<PolicyDraft> {
  draftCounter++;

  const filename = doctrine.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + ".policy.json";
  if (!fs.existsSync(POLICIES_DIR)) {
    fs.mkdirSync(POLICIES_DIR, { recursive: true });
  }

  const policy = {
    meta: {
      name: doctrine.title,
      doctrine_id: doctrine.doctrine_id,
      category: doctrine.category,
      priority: doctrine.priority,
      immutable: doctrine.immutable,
      compiled_at: new Date().toISOString(),
    },
    rule: {
      statement: doctrine.statement,
      enforcement: doctrine.immutable ? "hard" : "soft",
    },
    actions: doctrine.immutable
      ? [{ on_violation: "block", escalate_to: "operator" }]
      : [{ on_violation: "warn", escalate_to: "governance_dashboard" }],
  };

  const content = JSON.stringify(policy, null, 2);
  const filePath = path.join(POLICIES_DIR, filename);
  const gate = await checkEvolutionProposalGovernance({
    kind: "policy_compilation",
    proposal_id: `policy_${doctrine.doctrine_id}`,
    requested_by: "system",
    risk_hint: doctrine.immutable ? "critical" : "high",
  });
  if (gate.decision !== "allowed") {
    throw new Error(`Policy compilation requires governance clearance: ${gate.reason}`);
  }
  checkFileOperationGovernance({
    kind: "write", path: filePath, requested_by: "system",
    trace_id: `doctrine_policy_${doctrine.doctrine_id}`, risk_hint: "low",
  }).then(() => {}).catch(() => {});
  fs.writeFileSync(filePath, content, { encoding: "utf8" });

  const draft: PolicyDraft = {
    draft_id: `policy_draft_${Date.now()}_${draftCounter}`,
    doctrine_id: doctrine.doctrine_id,
    doctrine_title: doctrine.title,
    file_path: filePath,
    content,
    created_at: new Date().toISOString(),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(draft.draft_id, "policy_draft_compiled"),
    trace_id: draft.draft_id,
    job_id: "knowledge",
    type: "policy_draft_compiled",
    timestamp: draft.created_at,
    payload: {
      draft_id: draft.draft_id,
      doctrine_id: doctrine.doctrine_id,
      path: filePath,
    },
  });

  return draft;
}

export async function compileAllDoctrines(): Promise<PolicyDraft[]> {
  const doctrines = getAllDoctrines();
  return Promise.all(doctrines.map(compileDoctrineToPolicy));
}
