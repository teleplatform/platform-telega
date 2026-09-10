/**
 * @tele-gpt/dispatcher-core — Type Definitions
 *
 * Control plane types for the TeleGPT Dispatcher.
 * Covers four primary entity classes:
 *   Model   — WHAT runs (Qwen, Gemma, TeleGa, etc.)
 *   Runtime — HOW it runs (llama.cpp, WebGPU, Ollama, etc.)
 *   Provider — WHERE from (OpenAI API, Bridge, local endpoint, etc.)
 *   Device  — ON WHAT (Mac M3, RTX 3090, AI Station, Browser, etc.)
 *
 * Foundry is a separate subsystem for training/experiments,
 * not part of the inference hot path.
 */

// ─── Capability ──────────────────────────────────────
// TODO: Consolidate with src/core/provider-capability-registry.ts Capability.
// Currently duplicated here to keep dispatcher-core dependency-free.
// Once dispatcher-core is consumed by the main server, replace with a
// re-export from the canonical source.

export type Capability =
  | "reasoning"
  | "tools"
  | "vision"
  | "json"
  | "code"
  | "long_context"
  | "video"
  | "audio"
  | "image"
  | "streaming"
  | "function_calling";

// ─── Model ───────────────────────────────────────────
/** WHAT runs — a specific model artifact. */

export type ModelFormat =
  | "gguf"
  | "safetensors"
  | "onnx"
  | "webgpu"
  | "api-only"
  | "custom";

export type ModelStatus =
  | "active"
  | "disabled"
  | "experimental"
  | "archived";

export type ModelSource = "registry" | "foundry" | "imported" | "builtin";

export interface ModelManifestMeta {
  sizeBytes?: number;
  quantization?: string;
  license?: string;
  files?: string[];
  homepage?: string;
}

export interface ModelManifest {
  id: string;
  name: string;
  family: string;
  version: string;
  format: ModelFormat;
  capabilities: Capability[];
  status: ModelStatus;
  source: ModelSource;
  manifest: ModelManifestMeta;
  createdAt: string;
  updatedAt: string;
}

// ─── Runtime / Backend ───────────────────────────────
/** HOW it runs — a specific inference backend or engine. */

export type RuntimeKind =
  | "native-local"
  | "browser-webgpu"
  | "mobile-ondevice"
  | "ai-station"
  | "cloud-bridge";

export type RuntimeStatus =
  | "available"
  | "busy"
  | "stopped"
  | "error"
  | "provisioning";

export interface RuntimeConfig {
  id: string;
  name: string;
  kind: RuntimeKind;
  status: RuntimeStatus;
  endpoint?: string;
  devices: string[];
  supportedFormats: ModelFormat[];
  maxConcurrent: number;
  config: Record<string, unknown>;
  createdAt: string;
}

// ─── Provider ────────────────────────────────────────
/** WHERE from — an external or local provider endpoint. */

export type ProviderKind = "cloud-api" | "bridge" | "local-proxy" | "hybrid";

export interface ProviderHealth {
  status: "healthy" | "degraded" | "down" | "unknown";
  lastCheck: string;
  latencyMs?: number;
  errorRate?: number;
  successCount: number;
  failCount: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  kind: ProviderKind;
  enabled: boolean;
  priority: number;
  health: ProviderHealth;
  baseUrl?: string;
  apiKeyEnv?: string;
  runtimeRefs: string[];
  costPerToken?: { input: number; output: number };
  capabilities: Capability[];
  createdAt: string;
}

// ─── Device ──────────────────────────────────────────
/** ON WHAT — a physical or virtual execution target. */

export type DeviceKind =
  | "gpu"
  | "cpu"
  | "npu"
  | "tpu"
  | "browser"
  | "mobile"
  | "cluster-node";

export type DeviceStatus =
  | "available"
  | "busy"
  | "offline"
  | "maintenance";

export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
  model: string;
  totalMemoryMb: number;
  usedMemoryMb?: number;
  status: DeviceStatus;
  runtimeRefs: string[];
  metadata: Record<string, unknown>;
}

// ─── Routing Policy ──────────────────────────────────

export interface RoutingCondition {
  capability?: Capability;
  modelFamily?: string;
  runtimeKind?: RuntimeKind;
  providerKind?: ProviderKind;
  maxLatencyMs?: number;
  maxCostPerToken?: number;
  userRole?: string;
}

export interface RoutingAction {
  routeTo: string;
  fallback?: string;
  weight?: number;
}

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  condition: RoutingCondition;
  action: RoutingAction;
  enabled: boolean;
}

// ─── Routing Dry-Run / Explain ───────────────────────
// Phase 6B: pure simulation. Explaining which rule WOULD match must never be
// interpreted as proof that the referenced provider/runtime is healthy or
// available — the explainer does not consult health, capability registry,
// availability or cost data. It only evaluates rule conditions against the
// provided hypothetical input.

export type RoutingExplainOutcome = "matched" | "no_match";

/** Hypothetical control-plane facts supplied for simulation. */
export interface RoutingExplainInput {
  capability?: Capability;
  modelFamily?: string;
  runtimeKind?: RuntimeKind;
  providerKind?: ProviderKind;
  /** Observed/assumed latency to test against condition.maxLatencyMs. */
  latencyMs?: number;
  /** Observed/assumed per-token cost to test against condition.maxCostPerToken. */
  costPerToken?: number;
  userRole?: string;
}

/** Machine-readable per-condition verdict for a rule. */
export interface RoutingExplainReason {
  field: string;
  passed: boolean;
  /** What the rule required (for display / debugging). */
  expected?: string | number;
  /** What the input provided (absent → omitted). */
  observed?: string | number;
  message: string;
}

export interface RoutingExplainRuleEval {
  ruleId: string;
  ruleName: string;
  enabled: boolean;
  matched: boolean;
  reasons: RoutingExplainReason[];
}

export interface RoutingExplainWinner {
  ruleId: string;
  ruleName: string;
  /** routeTo is CONFIGURATION, not a guarantee about the target. */
  routeTo: string;
  fallback?: string;
  weight?: number;
}

export interface RoutingExplainResult {
  input: RoutingExplainInput;
  /** Rules in canonical order: priority DESC, then id ASC. */
  rules: RoutingExplainRuleEval[];
  winner?: RoutingExplainWinner;
  outcome: RoutingExplainOutcome;
}

// ─── Foundry ─────────────────────────────────────────
/** Training, evaluation, and experiment orchestration.
 *  Separate subsystem — not part of inference hot path. */

export type ExperimentStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ExperimentType =
  | "finetune"
  | "eval"
  | "benchmark"
  | "merge"
  | "quantize"
  | "custom";

export interface FoundryExperiment {
  id: string;
  name: string;
  status: ExperimentStatus;
  type: ExperimentType;
  modelId: string;
  engine: string;
  dataset?: string;
  config: Record<string, unknown>;
  metrics?: Record<string, number>;
  checkpointPath?: string;
  deviceId?: string;
  createdAt: string;
  completedAt?: string;
}

// ─── Cost / Latency ──────────────────────────────────

export interface CostRecord {
  timestamp: string;
  providerId: string;
  runtimeId?: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  requestId: string;
}

// ─── Logs ────────────────────────────────────────────

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface DispatcherLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ─── Dispatcher Overview ─────────────────────────────

export interface DispatcherOverview {
  modelCount: number;
  activeModelCount: number;
  providerCount: number;
  healthyProviderCount: number;
  runtimeCount: number;
  availableRuntimeCount: number;
  deviceCount: number;
  availableDeviceCount: number;
  activeExperimentCount: number;
  costTodayUsd: number;
  requestCountToday: number;
}

// ─── Registry CRUD Signatures ────────────────────────

export interface ModelRegistry {
  list(): ModelManifest[];
  getById(id: string): ModelManifest | undefined;
  create(model: Omit<ModelManifest, "createdAt" | "updatedAt">): ModelManifest;
  update(id: string, patch: Partial<ModelManifest>): ModelManifest | undefined;
  remove(id: string): boolean;
}

export interface ProviderRegistry {
  list(): ProviderConfig[];
  getById(id: string): ProviderConfig | undefined;
  create(provider: Omit<ProviderConfig, "createdAt">): ProviderConfig;
  update(id: string, patch: Partial<ProviderConfig>): ProviderConfig | undefined;
  remove(id: string): boolean;
  updateHealth(id: string, health: ProviderHealth): ProviderConfig | undefined;
}

export interface RuntimeRegistry {
  list(): RuntimeConfig[];
  getById(id: string): RuntimeConfig | undefined;
  create(runtime: Omit<RuntimeConfig, "createdAt">): RuntimeConfig;
  update(id: string, patch: Partial<RuntimeConfig>): RuntimeConfig | undefined;
  remove(id: string): boolean;
}

export interface DeviceRegistry {
  list(): Device[];
  getById(id: string): Device | undefined;
  update(id: string, patch: Partial<Device>): Device | undefined;
}

export interface RoutingRegistry {
  /** Deterministic order: priority DESC, then id ASC. */
  list(): RoutingRule[];
  getById(id: string): RoutingRule | undefined;
  /** Duplicate id → deterministic throw. */
  create(rule: RoutingRule): RoutingRule;
  update(id: string, patch: Partial<RoutingRule>): RoutingRule | undefined;
  remove(id: string): boolean;
}

export interface RoutingExplainer {
  /** Deterministic, side-effect free rule evaluation. */
  explain(input: RoutingExplainInput): RoutingExplainResult;
}

export interface CostTracker {
  record(entry: Omit<CostRecord, "timestamp">): CostRecord;
  query(filter: { providerId?: string; modelId?: string; since?: string }): CostRecord[];
  summary(filter: { since?: string }): { totalCostUsd: number; totalRequests: number; avgLatencyMs: number };
}

export interface FoundryManager {
  list(): FoundryExperiment[];
  getById(id: string): FoundryExperiment | undefined;
  create(experiment: Omit<FoundryExperiment, "id" | "createdAt">): FoundryExperiment;
  start(id: string): FoundryExperiment | undefined;
  cancel(id: string): FoundryExperiment | undefined;
}

export interface DispatcherLogSink {
  write(entry: Omit<DispatcherLog, "id" | "timestamp">): DispatcherLog;
  query(filter: { level?: LogLevel; source?: string; since?: string; limit?: number }): DispatcherLog[];
}
