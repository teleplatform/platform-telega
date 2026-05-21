import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type ResourceType =
  | "token"
  | "gpu"
  | "cpu"
  | "ram"
  | "operator_attention"
  | "queue_depth"
  | "replay_cost"
  | "federation_cost";

export interface ResourceUsage {
  type: ResourceType;
  current: number;
  limit: number;
  percentage: number;
  pressure_level: "low" | "medium" | "high" | "critical";
  timestamp: string;
}

export interface EconomyReport {
  report_id: string;
  timestamp: string;
  resources: ResourceUsage[];
  total_pressure_score: number;
  budget_pressure_detected: boolean;
  recommendations: string[];
}

let economyCounter = 0;
const BASE_LIMITS: Record<ResourceType, number> = {
  token: 100000,
  gpu: 100,
  cpu: 100,
  ram: 8192, // MB
  operator_attention: 100, // percent
  queue_depth: 1000,
  replay_cost: 10000, // cost units
  federation_cost: 5000, // cost units
};

export function estimateRuntimeCost(
  operationType: string,
  options?: { durationMinutes?: number; intensity?: "low" | "medium" | "high" }
): number {
  // Simplified cost estimation
  const baseCost = 100;
  const duration = options?.durationMinutes || 1;
  const intensityMultiplier = {
    low: 0.5,
    medium: 1.0,
    high: 2.0,
  }[options?.intensity || "medium"] || 1.0;

  const cost = baseCost * duration * intensityMultiplier;

  appendEvidenceRecord({
    evidence_id: hashTraceId(`cost_est_${Date.now()}`, "runtime_cost_estimated"),
    trace_id: `cost_est_${Date.now()}`,
    job_id: "economy",
    type: "runtime_cost_estimated",
    timestamp: new Date().toISOString(),
    payload: {
      operationType,
      estimatedCost: cost,
      durationMinutes: options?.durationMinutes,
      intensity: options?.intensity,
    },
  }).catch(console.error);

  return cost;
}

export function checkResourcePressure(): ResourceUsage[] {
  const pressures: ResourceUsage[] = [];
  const now = new Date().toISOString();

  // Simulate resource usage (in real implementation, would get actual metrics)
  for (const [type, limit] of Object.entries(BASE_LIMITS)) {
    // Simulate current usage as random percentage
    const current = Math.random() * limit * 0.8; // Up to 80% usage
    const percentage = (current / limit) * 100;

    let pressureLevel: ResourceUsage["pressure_level"];
    if (percentage >= 95) pressureLevel = "critical";
    else if (percentage >= 85) pressureLevel = "high";
    else if (percentage >= 70) pressureLevel = "medium";
    else pressureLevel = "low";

    pressures.push({
      type: type as ResourceType,
      current,
      limit,
      percentage: Number(percentage.toFixed(2)),
      pressure_level,
      timestamp: now,
    });
  }

  return pressures;
}

export function detectBudgetPressure(): {
  detected: boolean;
  pressure: ResourceUsage[];
  recommendations: string[];
} {
  const pressures = checkResourcePressure();
  const highPressureResources = pressures.filter(
    (p) => p.pressure_level === "high" || p.pressure_level === "critical"
  );

  const detected = highPressureResources.length > 0;

  let recommendations: string[] = [];
  if (detected) {
    recommendations = [
      "Consider scaling resources",
      "Review and optimize resource-intensive operations",
      "Check for resource leaks",
      "Implement resource pooling",
    ];

    // Add specific recommendations based on resource type
    highPressureResources.forEach((resource) => {
      switch (resource.type) {
        case "token":
          recommendations.push("Optimize prompts and context usage");
          break;
        case "gpu":
          recommendations.push("Consider model quantization or batching");
          break;
        case "operator_attention":
          recommendations.push("Increase automation to reduce manual oversight");
          break;
        case "queue_depth":
          recommendations.push("Increase worker concurrency or optimize processing");
          break;
      }
    });
  }

  if (detected) {
    appendEvidenceRecord({
      evidence_id: hashTraceId(`budget_pressure_${Date.now()}`, "runtime_budget_pressure_detected"),
      trace_id: `budget_pressure_${Date.now()}`,
      job_id: "economy",
      type: "runtime_budget_pressure_detected",
      timestamp: new Date().toISOString(),
      payload: {
        highPressureCount: highPressureResources.length,
        totalPressureScore: calculateTotalPressureScore(pressures),
      },
    }).catch(console.error);
  }

  return { detected, pressure: pressures, recommendations };
}

export function generateEconomyReport(): EconomyReport {
  economyCounter++;
  const pressures = checkResourcePressure();
  const budgetPressure = detectBudgetPressure();

  const report: EconomyReport = {
    report_id: `econ_report_${Date.now()}_${economyCounter}`,
    timestamp: new Date().toISOString(),
    resources: pressures,
    total_pressure_score: calculateTotalPressureScore(pressures),
    budget_pressure_detected: budgetPressure.detected,
    recommendations: budgetPressure.recommendations,
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(report.report_id, "runtime_economy_report_generated"),
    trace_id: report.report_id,
    job_id: "economy",
    type: "runtime_economy_report_generated",
    timestamp: report.timestamp,
    payload: {
      report_id: report.report_id,
      resources_count: report.resources.length,
      budget_pressure: report.budget_pressure_detected,
      total_pressure: report.total_pressure_score,
    },
  }).catch(console.error);

  return report;
}

function calculateTotalPressureScore(pressures: ResourceUsage[]): number {
  if (pressures.length === 0) return 0;

  const weightMap: Record<ResourceUsage["pressure_level"], number> = {
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    critical: 1.0,
  };

  const total = pressures.reduce((sum, p) => {
    const weight = weightMap[p.pressure_level] || 0.5;
    return sum + (weight * (p.percentage / 100));
  }, 0);

  return Number((total / pressures.length * 100).toFixed(2));
}

export function getEconomyReportCount(): number {
  return economyCounter;
}