import type { MeshControlRequest } from './mesh-control-types.js';

export interface SecurityBoundaryResult {
  allowed: boolean;
  reason?: string;
}

export function validateMeshCommandScope(
  request: MeshControlRequest,
  allowedCommands: string[]
): SecurityBoundaryResult {
  if (!allowedCommands.includes(request.command)) {
    return {
      allowed: false,
      reason: `Command ${request.command} not in allowed scope`,
    };
  }
  return { allowed: true };
}

export function validateNodeTrust(nodeId: string, trustedNodes: string[]): SecurityBoundaryResult {
  if (!trustedNodes.includes(nodeId)) {
    return {
      allowed: false,
      reason: `Node ${nodeId} is not trusted`,
    };
  }
  return { allowed: true };
}

export function validateRemoteExecutionBoundary(
  sourceNodeId: string,
  targetNodeId: string,
  allowedCrossNode: boolean
): SecurityBoundaryResult {
  if (sourceNodeId !== targetNodeId && !allowedCrossNode) {
    return {
      allowed: false,
      reason: 'Cross-node execution not permitted by security boundary',
    };
  }
  return { allowed: true };
}
