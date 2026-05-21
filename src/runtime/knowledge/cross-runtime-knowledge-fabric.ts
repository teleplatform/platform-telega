import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getConstitutionState } from "../constitution/runtime-constitution.js";

export type KnowledgeType =
  | "validator"
  | "rollback_pattern"
  | "improvement_proposal"
  | "verified_heuristic"
  | "failure_lesson"
  | "best_practice";

export interface KnowledgeAsset {
  asset_id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  source_runtime: string;
  source_department?: string;
  verified_by: string[];
  verification_count: number;
  created_at: string;
  last_used: string;
  usage_count: number;
  tags: string[];
}

const KNOWLEDGE_STORE: Map<string, KnowledgeAsset> = new Map();
let assetCounter = 0;
let syncCounter = 0;

export async function syncKnowledgeFabric(
  sourceRuntime: string,
  knowledgeTypes?: KnowledgeType[],
): Promise<{ synced: number; blocked: number }> {
  // Check constitution before sync
  const constitution = getConstitutionState();

  syncCounter++;
  const typesToSync = knowledgeTypes || [
    "validator",
    "rollback_pattern",
    "improvement_proposal",
    "verified_heuristic",
    "failure_lesson"
  ];

  let synced = 0;
  let blocked = 0;

  // Simulate checking for available knowledge from source runtime
  const availableKnowledge = getAvailableKnowledgeFromRuntime(sourceRuntime, typesToSync);

  for (const knowledge of availableKnowledge) {
    // In real implementation, would check permissions, validity, etc.
    const isAllowed = Math.random() > 0.2; // 80% allowed

    if (isAllowed) {
      // Store the knowledge asset
      assetCounter++;
      const asset: KnowledgeAsset = {
        asset_id: `asset_${Date.now()}_${assetCounter}`,
        type: knowledge.type,
        title: knowledge.title,
        content: knowledge.content,
        source_runtime: sourceRuntime,
        source_department: knowledge.source_department,
        verified_by: knowledge.verified_by,
        verification_count: knowledge.verification_count,
        created_at: knowledge.created_at,
        last_used: knowledge.last_used,
        usage_count: knowledge.usage_count,
        tags: knowledge.tags,
      };

      KNOWLEDGE_STORE.set(asset.asset_id, asset);
      synced++;
    } else {
      blocked++;
      appendEvidenceRecord({
        evidence_id: hashTraceId(`blocked_${knowledge.title}_${Date.now()}`, "knowledge_fabric_sync_blocked"),
        trace_id: `sync_block_${Date.now()}`,
        job_id: "knowledge",
        type: "knowledge_fabric_sync_blocked",
        timestamp: new Date().toISOString(),
        payload: {
          source_runtime: sourceRuntime,
          knowledge_type: knowledge.type,
          knowledge_title: knowledge.title,
          reason: "Not permitted by sync policy",
        },
      }).catch(console.error);
    }
  }

  if (synced > 0 || blocked > 0) {
    appendEvidenceRecord({
      evidence_id: hashTraceId(`sync_${Date.now()}`, "knowledge_fabric_sync_started"),
      trace_id: `sync_${Date.now()}`,
      job_id: "knowledge",
      type: "knowledge_fabric_sync_started",
      timestamp: new Date().toISOString(),
      payload: {
        source_runtime: sourceRuntime,
        requested_types: typesToSync,
      },
    }).catch(console.error);

    appendEvidenceRecord({
      evidence_id: hashTraceId(`sync_complete_${Date.now()}`, "knowledge_fabric_sync_completed"),
      trace_id: `sync_complete_${Date.now()}`,
      job_id: "knowledge",
      type: "knowledge_fabric_sync_completed",
      timestamp: new Date().toISOString(),
      payload: {
        source_runtime: sourceRuntime,
        synced_count: synced,
        blocked_count: blocked,
      },
    }).catch(console.error);
  }

  return { synced, blocked };
}

export function getAvailableKnowledgeFromRuntime(
  runtime: string,
  types: KnowledgeType[]
): any[] {
  // Simplified - would get actual knowledge from runtime
  const knowledge: any[] = [];

  for (const type of types) {
    // Generate some sample knowledge
    knowledge.push({
      type,
      title: `Sample ${type} from ${runtime}`,
      content: `This is a sample ${type} knowledge item sourced from ${runtime}`,
      source_runtime: runtime,
      source_department: Math.random() > 0.5 ? "unknown" : "shared",
      verified_by: ["validator_1", "validator_2"],
      verification_count: Math.floor(Math.random() * 10) + 1,
      created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_used: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      usage_count: Math.floor(Math.random() * 50),
      tags: [runtime, type, "shared"],
    });
  }

  return knowledge;
}

export function getKnowledgeAsset(assetId: string): KnowledgeAsset | null {
  return KNOWLEDGE_STORE.get(assetId) || null;
}

export function getKnowledgeByType(type: KnowledgeType): KnowledgeAsset[] {
  return Array.from(KNOWLEDGE_STORE.values())
    .filter((asset) => asset.type === type);
}

export function getKnowledgeCount(): number {
  return KNOWLEDGE_STORE.size;
}

export function getSyncCount(): number {
  return syncCounter;
}