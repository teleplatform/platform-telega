import * as child_process from "child_process";
import * as util from "util";
import * as fs from "fs";

const execAsync = util.promisify(child_process.exec);

export interface ResourceSnapshot {
  memoryUsedGb: number;
  memoryTotalGb: number;
  memoryFreeGb: number;
  memoryPressure: "normal" | "warning" | "critical";
  swapUsedMb: number;
  cpuUsagePercent: number;
  loadedModels: string[];
  timestamp: number;
}

export interface ResourceProfile {
  ramCostGb: number;
  cpuCost: number;
  priority: "low" | "medium" | "high";
}

export const MODEL_RESOURCE_PROFILES: Record<string, ResourceProfile> = {
  "local:gemma3n": { ramCostGb: 2, cpuCost: 1, priority: "low" },
  "local:qwen3:8b": { ramCostGb: 4, cpuCost: 3, priority: "medium" },
  "local:gemma4:12b": { ramCostGb: 8, cpuCost: 5, priority: "high" },
  "local:deepseek": { ramCostGb: 1.5, cpuCost: 2, priority: "low" },
  "local:mistral": { ramCostGb: 4, cpuCost: 2, priority: "medium" },
  "local:minicpm-v": { ramCostGb: 4, cpuCost: 3, priority: "medium" },
  "local:moondream": { ramCostGb: 3, cpuCost: 2, priority: "medium" },
  "local:translategemma": { ramCostGb: 6, cpuCost: 3, priority: "high" },
};

async function getMemoryInfo(): Promise<{ usedGb: number; freeGb: number; totalGb: number; pressure: ResourceSnapshot["memoryPressure"] }> {
  try {
    // macOS: vm_stat for page info, sysctl for total
    const { stdout: memPressureOut } = await execAsync("memory_pressure 2>/dev/null | head -5", { timeout: 3000 });
    const { stdout: vmStatOut } = await execAsync("vm_stat 2>/dev/null | head -10", { timeout: 3000 });
    const { stdout: totalMemOut } = await execAsync("sysctl hw.memsize 2>/dev/null", { timeout: 3000 });

    const totalGb = parseInt(totalMemOut.match(/(\d+)/)?.[0] || "8589934592") / 1024 / 1024 / 1024;

    // Parse vm_stat
    const pageSize = 16384; // macOS default
    const activeMatch = vmStatOut.match(/Pages active:\s+(\d+)/);
    const wiredMatch = vmStatOut.match(/Pages wired down:\s+(\d+)/);
    const freeMatch = vmStatOut.match(/Pages free:\s+(\d+)/);
    const compressedMatch = vmStatOut.match(/Pages occupied by compressor:\s+(\d+)/);

    const activePages = parseInt(activeMatch?.[1] || "0");
    const wiredPages = parseInt(wiredMatch?.[1] || "0");
    const freePages = parseInt(freeMatch?.[1] || "0");
    const compressedPages = parseInt(compressedMatch?.[1] || "0");

    const usedBytes = (activePages + wiredPages + compressedPages) * pageSize;
    const freeBytes = freePages * pageSize;
    const usedGb = Math.round((usedBytes / 1024 / 1024 / 1024) * 10) / 10;
    const freeGb = Math.round((freeBytes / 1024 / 1024 / 1024) * 10) / 10;

    const pressure: ResourceSnapshot["memoryPressure"] =
      usedGb / totalGb > 0.85 ? "critical"
      : usedGb / totalGb > 0.7 ? "warning"
      : "normal";

    return { usedGb, freeGb, totalGb: Math.round(totalGb * 10) / 10, pressure };
  } catch {
    // Fallback: estimate from process
    const usedGb = 4.0;
    const totalGb = 8.0;
    return { usedGb, freeGb: totalGb - usedGb, totalGb, pressure: "normal" };
  }
}

async function getSwapInfo(): Promise<number> {
  try {
    const { stdout } = await execAsync("sysctl vm.swapusage 2>/dev/null", { timeout: 3000 });
    const match = stdout.match(/total = (\d+\.\d+)M\s+used = (\d+\.\d+)M/);
    if (match) {
      return Math.round(parseFloat(match[2]) * 10) / 10;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function getCpuUsage(): Promise<number> {
  try {
    const { stdout } = await execAsync("ps -A -o %cpu | awk '{s+=$1} END {print s}'", { timeout: 3000 });
    const usage = parseFloat(stdout.trim());
    return isNaN(usage) ? 0 : Math.round(usage * 10) / 10;
  } catch {
    return 0;
  }
}

async function getOllamaLoadedModels(): Promise<string[]> {
  try {
    const { stdout } = await execAsync("ollama ps 2>/dev/null", { timeout: 5000 });
    const lines = stdout.trim().split("\n").slice(1); // Skip header
    return lines.map((l) => l.split(/\s+/)[0]).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getResourceSnapshot(): Promise<ResourceSnapshot> {
  const [memory, swapMb, cpu, loadedModels] = await Promise.all([
    getMemoryInfo(),
    getSwapInfo(),
    getCpuUsage(),
    getOllamaLoadedModels(),
  ]);

  return {
    memoryUsedGb: memory.usedGb,
    memoryTotalGb: memory.totalGb,
    memoryFreeGb: memory.freeGb,
    memoryPressure: memory.pressure,
    swapUsedMb: swapMb,
    cpuUsagePercent: cpu,
    loadedModels,
    timestamp: Date.now(),
  };
}

export function getResourceScoreForModel(
  modelId: string,
  snapshot: ResourceSnapshot
): number {
  const profile = MODEL_RESOURCE_PROFILES[modelId] || MODEL_RESOURCE_PROFILES[`local:${modelId}`];
  if (!profile) return 50; // neutral

  const freeGb = snapshot.memoryFreeGb;
  const profileKey = modelId.startsWith("local:") ? modelId : `local:${modelId}`;
  const realProfile = MODEL_RESOURCE_PROFILES[profileKey] || profile;

  // Already loaded — bonus (check first, no extra RAM cost)
  if (snapshot.loadedModels.some((m) => modelId.includes(m.split(":")[0]))) {
    return 90;
  }

  if (freeGb < 1 && realProfile.ramCostGb >= 4) {
    return 10; // severely penalize
  }
  if (freeGb < 2 && realProfile.ramCostGb >= 6) {
    return 15;
  }
  if (freeGb < realProfile.ramCostGb) {
    return 20; // may cause swap
  }
  if (snapshot.memoryPressure === "critical" && realProfile.ramCostGb > 2) {
    return 25;
  }
  if (snapshot.memoryPressure === "warning" && realProfile.ramCostGb >= 4) {
    return 35;
  }

  // Good
  if (freeGb >= realProfile.ramCostGb * 2) {
    return 90;
  }
  if (freeGb >= realProfile.ramCostGb) {
    return 75;
  }

  return 50;
}

export function formatResourceSnapshot(snapshot: ResourceSnapshot): string {
  const memIcon = snapshot.memoryPressure === "critical" ? "🔴" : snapshot.memoryPressure === "warning" ? "🟡" : "🟢";
  const swapStr = snapshot.swapUsedMb > 1000
    ? `${(snapshot.swapUsedMb / 1000).toFixed(1)} GB`
    : `${snapshot.swapUsedMb} MB`;

  const lines = [
    `🖥 *Runtime Resources*`,
    ``,
    `${memIcon} RAM: ${snapshot.memoryUsedGb} / ${snapshot.memoryTotalGb} GB (${snapshot.memoryFreeGb} GB free)`,
    `🔄 Swap: ${swapStr}`,
    `⚡ CPU: ${snapshot.cpuUsagePercent}%`,
    ``,
    `📦 Loaded Models:`,
  ];

  if (snapshot.loadedModels.length === 0) {
    lines.push(`   (none)`);
  } else {
    for (const m of snapshot.loadedModels) {
      const profile = Object.entries(MODEL_RESOURCE_PROFILES).find(([k]) => m.includes(k.split(":")[1] || k));
      const cost = profile ? ` (~${profile[1].ramCostGb} GB)` : "";
      lines.push(`   • ${m}${cost}`);
    }
  }

  return lines.join("\n");
}
