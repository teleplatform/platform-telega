import type { MeshDashboardState } from './mesh-dashboard-aggregator.js';

const snapshots = new Map<string, MeshDashboardState>();

export function saveMeshDashboardSnapshot(state: MeshDashboardState, id?: string): string {
  const snapshotId = id || `snap_${Date.now()}`;
  snapshots.set(snapshotId, { ...state });
  return snapshotId;
}

export function getLastMeshDashboardSnapshot(): MeshDashboardState | undefined {
  const keys = Array.from(snapshots.keys()).sort().reverse();
  return keys.length > 0 ? snapshots.get(keys[0]) : undefined;
}

export function listMeshDashboardSnapshots(limit = 20): { id: string; generatedAt: number }[] {
  return Array.from(snapshots.entries())
    .map(([id, state]) => ({ id, generatedAt: state.generatedAt }))
    .sort((a, b) => b.generatedAt - a.generatedAt)
    .slice(0, limit);
}

export function clearMeshDashboardSnapshots(): void {
  snapshots.clear();
}

export function getMeshDashboardSnapshot(id: string): MeshDashboardState | undefined {
  return snapshots.get(id);
}
