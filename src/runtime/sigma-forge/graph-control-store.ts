import type { ExecutionGraph } from './sigma-forge-types.js';

export interface GraphControlState {
  paused: boolean;
  cancelled: boolean;
  pausedAt: number | null;
  cancelledAt: number | null;
  graphId: string;
}

const controlStates = new Map<string, GraphControlState>();

export function initControlState(graphId: string): GraphControlState {
  const state: GraphControlState = {
    graphId,
    paused: false,
    cancelled: false,
    pausedAt: null,
    cancelledAt: null,
  };
  controlStates.set(graphId, state);
  return state;
}

export function getControlState(graphId: string): GraphControlState | undefined {
  return controlStates.get(graphId);
}

export function pauseGraph(graphId: string): boolean {
  const state = controlStates.get(graphId);
  if (!state) return false;
  state.paused = true;
  state.pausedAt = Date.now();
  return true;
}

export function resumeGraph(graphId: string): boolean {
  const state = controlStates.get(graphId);
  if (!state) return false;
  state.paused = false;
  return true;
}

export function cancelGraph(graphId: string): boolean {
  const state = controlStates.get(graphId);
  if (!state) return false;
  state.cancelled = true;
  state.cancelledAt = Date.now();
  return true;
}

export function removeControlState(graphId: string): boolean {
  return controlStates.delete(graphId);
}

export function checkControl(graphId: string): { paused: boolean; cancelled: boolean } {
  const state = controlStates.get(graphId);
  if (!state) return { paused: false, cancelled: false };
  return { paused: state.paused, cancelled: state.cancelled };
}
