/**
 * @tele-gpt/dispatcher-core — Barrel Export
 *
 * Re-exports all types and factory functions.
 * Import from '@tele-gpt/dispatcher-core' or '@tele-gpt/dispatcher-core/types'.
 */

export type {
  // Capability
  Capability,

  // Model
  ModelFormat,
  ModelStatus,
  ModelSource,
  ModelManifestMeta,
  ModelManifest,

  // Runtime
  RuntimeKind,
  RuntimeStatus,
  RuntimeConfig,

  // Provider
  ProviderKind,
  ProviderHealth,
  ProviderConfig,

  // Device
  DeviceKind,
  DeviceStatus,
  Device,

  // Routing
  RoutingCondition,
  RoutingAction,
  RoutingRule,
  RoutingExplainOutcome,
  RoutingExplainInput,
  RoutingExplainReason,
  RoutingExplainRuleEval,
  RoutingExplainWinner,
  RoutingExplainResult,

  // Foundry
  ExperimentStatus,
  ExperimentType,
  FoundryExperiment,

  // Cost / Latency
  CostRecord,

  // Logs
  LogLevel,
  DispatcherLog,

  // Overview
  DispatcherOverview,

  // Registry interfaces
  ModelRegistry,
  ProviderRegistry,
  RuntimeRegistry,
  DeviceRegistry,
  RoutingRegistry,
  RoutingExplainer,
  CostTracker,
  FoundryManager,
  DispatcherLogSink,
} from "./types.js";

export { createModelRegistry, createSqliteModelRegistry } from "./model-registry.js";
export {
  createProviderRegistry,
  createSqliteProviderRegistry,
} from "./provider-registry.js";
export {
  createRuntimeRegistry,
  createSqliteRuntimeRegistry,
} from "./runtime-registry.js";
export {
  createDeviceRegistry,
  createSqliteDeviceRegistry,
} from "./device-registry.js";
export {
  createRoutingRegistry,
  createSqliteRoutingRegistry,
} from "./routing-registry.js";
export {
  createRoutingExplainer,
  evaluateRoutingRules,
  evaluateRuleCondition,
} from "./routing-explainer.js";
export { ensureDispatcherSchema } from "./schema.js";
