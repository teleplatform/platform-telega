import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type DoctrineCategory =
  | "epistemic"
  | "governance"
  | "sovereignty"
  | "survival"
  | "ethics"
  | "federation";

export type DoctrinePriority = 1 | 2 | 3;

export interface DoctrineEntry {
  doctrine_id: string;
  category: DoctrineCategory;
  title: string;
  statement: string;
  priority: DoctrinePriority;
  immutable: boolean;
  created_at: string;
}

const DOCTRINES: Map<string, DoctrineEntry> = new Map();
let doctrineCounter = 0;

const DEFAULT_DOCTRINES: Array<Pick<DoctrineEntry, "category" | "title" | "statement" | "priority" | "immutable">> = [
  { category: "epistemic", title: "Evidence Before Claim", statement: "No claim shall be asserted without supporting evidence.", priority: 1, immutable: true },
  { category: "governance", title: "No Silent Mutation", statement: "No modification to runtime state shall occur without evidence trail.", priority: 1, immutable: true },
  { category: "sovereignty", title: "Creator Sovereignty", statement: "Creator authority supersedes all runtime autonomy.", priority: 1, immutable: true },
  { category: "governance", title: "Governed Autonomy", statement: "Runtime autonomy operates within constitutional bounds.", priority: 2, immutable: false },
  { category: "survival", title: "Runtime Survival First", statement: "Runtime survival takes precedence over non-critical operations.", priority: 1, immutable: true },
  { category: "ethics", title: "Ethical Constraint", statement: "All actions must pass ethical validation.", priority: 1, immutable: true },
  { category: "federation", title: "Federation Integrity", statement: "Federation actions must not compromise node sovereignty.", priority: 2, immutable: false },
];

export function initializeDoctrines(): void {
  for (const d of DEFAULT_DOCTRINES) {
    const id = `doctrine_${d.category}_${Date.now()}_${doctrineCounter++}`;
    DOCTRINES.set(id, {
      doctrine_id: id,
      category: d.category,
      title: d.title,
      statement: d.statement,
      priority: d.priority,
      immutable: d.immutable,
      created_at: new Date().toISOString(),
    });
  }
}

export async function registerDoctrine(
  category: DoctrineCategory,
  title: string,
  statement: string,
  priority: DoctrinePriority = 2,
  immutable = false,
): Promise<DoctrineEntry> {
  doctrineCounter++;
  const entry: DoctrineEntry = {
    doctrine_id: `doctrine_${Date.now()}_${doctrineCounter}`,
    category,
    title,
    statement,
    priority,
    immutable,
    created_at: new Date().toISOString(),
  };

  DOCTRINES.set(entry.doctrine_id, entry);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(entry.doctrine_id, "runtime_doctrine_registered"),
    trace_id: entry.doctrine_id,
    job_id: "knowledge",
    type: "runtime_doctrine_registered",
    timestamp: entry.created_at,
    payload: {
      doctrine_id: entry.doctrine_id,
      category,
      title,
      priority,
      immutable,
    },
  });

  return entry;
}

export function getDoctrine(doctrineId: string): DoctrineEntry | null {
  return DOCTRINES.get(doctrineId) || null;
}

export function getDoctrinesByCategory(category: DoctrineCategory): DoctrineEntry[] {
  return Array.from(DOCTRINES.values()).filter((d) => d.category === category);
}

export function getAllDoctrines(): DoctrineEntry[] {
  return Array.from(DOCTRINES.values()).sort((a, b) => a.priority - b.priority);
}
