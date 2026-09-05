// TODO(RD-2): implement memory module
export function initializeIdentityMemory(): void {}
export function recordRuntimeEvent(_type: string, _msg: string): void {}
export function updateCreatorInteraction(_userId: string): void {}
export function getCreatorSummary(_userId: string): string { return ""; }
export { addTurn, getRecentTurns } from "./session-memory.js";
export { getOperationalSummary, recordOperation } from "./operational-memory.js";

export {
  createMemoryStoreAdapter,
  writeMemoryRecord,
  readMemoryRecord,
  queryMemoryRecords,
  updateMemoryRecord,
  deleteExpiredMemoryRecords,
  appendEvidenceLinkedRecord,
  type MemoryStoreAdapter,
  type MemoryStoreRecord,
  type MemoryStoreQuery,
  type MemoryStoreWriteResult,
  type MemoryStoreBackend,
} from "./memory-store-adapter.js";

export {
  attachMemoryContext,
  resolveProjectFromMessage,
  clearActiveTaskStore,
  getActiveTask,
  updateActiveTaskAfterWriteback,
  type MemoryAttachment,
  type AttachMemoryContextInput,
  type UserIdentity,
  type SurfaceContext,
  type ProjectContext,
  type TaskContext,
} from "./memory-context-attachment.js";

export {
  writebackMemory,
  excerptText,
  extractCanonicalCandidates,
  type MemoryWritebackInput,
  type MemoryWritebackResult,
  type WritebackDeliveryStatus,
} from "./memory-writeback.js";

export {
  retrieveMemoryForPrompt,
  formatRetrievedMemoryForPrompt,
  type MemoryRetrievalInput,
  type MemoryRetrievalResult,
  type RetrievedMemoryItem,
  type DroppedMemoryItem,
  type RetrievedMemoryType,
} from "./memory-retrieval-guard.js";

export {
  runMemoryPipelineSmoke,
  runMemoryPipelineGuard,
  type MemoryPipelineSmokeResult,
  type MemoryPipelineSmokeCheck,
  type MemoryPipelineGuardStatus,
} from "./memory-pipeline-smoke.js";

export {
  recordMemoryDebugAttach,
  recordMemoryDebugRetrieval,
  recordMemoryDebugWriteback,
  getMemoryDebugSnapshot,
  clearMemoryDebugStore,
} from "./memory-debug-store.js";

export {
  buildMemoryDebugPanel,
  assertMemoryDebugAccess,
  redactSecrets,
  type MemoryDebugPanelResponse,
} from "./memory-debug-panel.js";

export {
  classifyMemoryPrivacy,
  classifyMemoryRetention,
  applyMemoryRetentionPolicy,
  redactMemorySecrets,
  shouldExpireMemoryItem,
  isMemoryAllowedInPrompt,
  sanitizeMemoryTextForPrompt,
  privacyBlockReason,
  RETENTION_TTL_MS,
  type MemoryPrivacyLevel,
  type MemoryRetentionClass,
  type MemoryRetentionPolicy,
  type MemoryRetentionDecision,
  type MemoryPolicyItem,
} from "./memory-retention-policy.js";

export {
  runMemoryPrivacyPolicySmoke,
  runMemoryPrivacyPolicyGuard,
  type MemoryPrivacyPolicySmokeResult,
  type MemoryPrivacyPolicyGuardStatus,
} from "./memory-privacy-policy-smoke.js";

export {
  detectCanonCandidates,
  queueCanonCandidate,
  reviewCanonCandidate,
  promoteAcceptedCandidate,
  getCanonCandidate,
  getPromotedCanonicalDecisions,
  buildMissionControlCanonRef,
  clearCanonCandidateStore,
  type CanonCandidate,
  type CanonPromotionDecision,
  type CanonPromotionResult,
  type CanonCandidateStatus,
} from "./memory-canon-promotion.js";