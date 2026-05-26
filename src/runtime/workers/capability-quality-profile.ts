import type { RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';

export interface QualityWeights {
  reliability: number;
  performance: number;
  confidence: number;
  latency: number;
}

export interface CapabilityQualityProfile {
  capability: RuntimeCapability;
  minSuccessRate: number;
  maxAverageDurationMs: number;
  minConfidence: number;
  weights: QualityWeights;
  description: string;
}

const DEFAULT_WEIGHTS: QualityWeights = {
  reliability: 0.4,
  performance: 0.3,
  confidence: 0.2,
  latency: 0.1
};

const profiles: Map<RuntimeCapability, CapabilityQualityProfile> = new Map();

function initDefaultProfiles(): void {
  const all: CapabilityQualityProfile[] = [
    {
      capability: 'browser',
      minSuccessRate: 0.8,
      maxAverageDurationMs: 15000,
      minConfidence: 0.3,
      weights: { reliability: 0.5, performance: 0.2, confidence: 0.2, latency: 0.1 },
      description: 'Browser automation — prefers reliability over speed'
    },
    {
      capability: 'memory',
      minSuccessRate: 0.95,
      maxAverageDurationMs: 500,
      minConfidence: 0.5,
      weights: { reliability: 0.3, performance: 0.3, confidence: 0.3, latency: 0.1 },
      description: 'Memory operations — expects near-perfect success'
    },
    {
      capability: 'execution',
      minSuccessRate: 0.85,
      maxAverageDurationMs: 10000,
      minConfidence: 0.3,
      weights: { reliability: 0.4, performance: 0.3, confidence: 0.2, latency: 0.1 },
      description: 'Shell/HTTP execution — balanced reliability and speed'
    },
    {
      capability: 'evidence',
      minSuccessRate: 0.9,
      maxAverageDurationMs: 2000,
      minConfidence: 0.4,
      weights: { reliability: 0.4, performance: 0.2, confidence: 0.3, latency: 0.1 },
      description: 'Evidence recording — fast and reliable'
    },
    {
      capability: 'governance',
      minSuccessRate: 0.99,
      maxAverageDurationMs: 200,
      minConfidence: 0.6,
      weights: { reliability: 0.5, performance: 0.1, confidence: 0.4, latency: 0.0 },
      description: 'Governance checks — must be reliable, latency irrelevant'
    },
    {
      capability: 'goals',
      minSuccessRate: 0.9,
      maxAverageDurationMs: 1000,
      minConfidence: 0.4,
      weights: { reliability: 0.3, performance: 0.3, confidence: 0.3, latency: 0.1 },
      description: 'Goal lifecycle — balanced'
    }
  ];

  for (const p of all) {
    profiles.set(p.capability, p);
  }
}

initDefaultProfiles();

export function getQualityProfile(capability: RuntimeCapability): CapabilityQualityProfile {
  return profiles.get(capability) ?? {
    capability,
    minSuccessRate: 0.8,
    maxAverageDurationMs: 10000,
    minConfidence: 0.2,
    weights: { ...DEFAULT_WEIGHTS },
    description: 'Default profile'
  };
}

export function setQualityProfile(profile: CapabilityQualityProfile): void {
  profiles.set(profile.capability, profile);
}

export function getAllQualityProfiles(): CapabilityQualityProfile[] {
  return [...profiles.values()];
}

export function checkQualityThreshold(metrics: { successRate: number; averageDurationMs: number; totalExecutions: number }, capability: RuntimeCapability): { pass: boolean; failures: string[] } {
  const profile = getQualityProfile(capability);
  const failures: string[] = [];

  if (metrics.totalExecutions > 0 && metrics.successRate < profile.minSuccessRate) {
    failures.push(`Success rate ${(metrics.successRate * 100).toFixed(1)}% < min ${(profile.minSuccessRate * 100).toFixed(0)}%`);
  }
  if (metrics.totalExecutions > 0 && metrics.averageDurationMs > profile.maxAverageDurationMs) {
    failures.push(`Avg duration ${metrics.averageDurationMs.toFixed(0)}ms > max ${profile.maxAverageDurationMs}ms`);
  }

  return { pass: failures.length === 0, failures };
}
