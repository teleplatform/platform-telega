import * as child_process from "child_process";
import * as os from "os";
import * as util from "util";
import { ResourceSnapshot, ResourceAlert } from "./resourceTypes";

const execAsync = util.promisify(child_process.exec);

let counter = 0;
function genId(): string {
  counter++;
  return `rs_${Date.now()}_${counter}`;
}

const snapshots: ResourceSnapshot[] = [];
const alerts: ResourceAlert[] = [];

export async function captureSnapshot(): Promise<ResourceSnapshot> {
  const cpus = os.cpus();
  const totalRam = os.totalmem();
  const freeRam = os.freemem();
  const loadAvg = os.loadavg();

  const ramUsedGb = (totalRam - freeRam) / 1024 / 1024 / 1024;
  const ramTotalGb = totalRam / 1024 / 1024 / 1024;
  const ramPercent = Math.round((ramUsedGb / ramTotalGb) * 100);

  // CPU estimate from load average (1 min)
  const cpuPercent = Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100));

  // Swap (macOS)
  let swapPercent = 0;
  let swapUsedMb = 0;
  try {
    const { stdout } = await execAsync("sysctl vm.swapusage 2>/dev/null | head -1");
    const match = stdout.match(/used = (\d+\.\d+)M/);
    if (match) {
      swapUsedMb = Math.round(parseFloat(match[1]));
      const totalMatch = stdout.match(/total = (\d+\.\d+)M/);
      if (totalMatch) {
        const totalMb = parseFloat(totalMatch[1]);
        swapPercent = totalMb > 0 ? Math.round((swapUsedMb / totalMb) * 100) : 0;
      }
    }
  } catch {
    // ignore
  }

  // Disk (root)
  let diskFreeGb = 0;
  try {
    const { stdout } = await execAsync("df -k / 2>/dev/null | tail -1");
    const parts = stdout.trim().split(/\s+/);
    if (parts.length >= 4) {
      diskFreeGb = Math.round(parseInt(parts[3], 10) / 1024 / 1024 * 10) / 10;
    }
  } catch {
    // ignore
  }

  const snapshot: ResourceSnapshot = {
    snapshotId: genId(),
    cpuPercent,
    ramPercent,
    ramFreeGb: Math.round((ramTotalGb - ramUsedGb) * 10) / 10,
    ramTotalGb: Math.round(ramTotalGb * 10) / 10,
    swapPercent,
    swapUsedMb,
    diskFreeGb,
    activeJobs: 0,
    activeAgents: 0,
    activeRepairs: 0,
    timestamp: Date.now(),
  };

  snapshots.push(snapshot);

  // Generate alerts
  checkThreshold("ramPercent", ramPercent, 85, 92, `RAM at ${ramPercent}%`);
  checkThreshold("cpuPercent", cpuPercent, 90, 95, `CPU at ${cpuPercent}%`);
  checkThreshold("swapPercent", swapPercent, 40, 60, `Swap at ${swapPercent}%`);

  return snapshot;
}

function checkThreshold(metric: string, value: number, warnAt: number, critAt: number, message: string): void {
  if (value >= critAt) {
    alerts.push({
      alertId: genId(),
      severity: "critical",
      metric,
      value,
      threshold: critAt,
      message: `CRITICAL: ${message}`,
      timestamp: Date.now(),
    });
  } else if (value >= warnAt) {
    alerts.push({
      alertId: genId(),
      severity: "warning",
      metric,
      value,
      threshold: warnAt,
      message: `WARNING: ${message}`,
      timestamp: Date.now(),
    });
  }
}

export function getLatestSnapshot(): ResourceSnapshot | null {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

export function getHistory(): ResourceSnapshot[] {
  return [...snapshots];
}

export function getAlerts(): ResourceAlert[] {
  return [...alerts];
}

export function getLatestAlerts(limit = 5): ResourceAlert[] {
  return alerts.slice(-limit);
}
