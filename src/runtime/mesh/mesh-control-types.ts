export type MeshControlCommand =
  | 'nodes'
  | 'health'
  | 'drain_node'
  | 'recover'
  | 'route_test'
  | 'sync_evidence'
  | 'contracts';

export interface MeshControlRequest {
  command: MeshControlCommand;
  actorId: string;
  target?: string;
  parameters?: Record<string, unknown>;
  timestamp: number;
}

export interface MeshControlResponse {
  command: MeshControlCommand;
  success: boolean;
  data?: unknown;
  error?: string;
  executedAt: number;
  actorId: string;
}

export interface MeshControlHandler {
  command: MeshControlCommand;
  handle(request: MeshControlRequest): Promise<MeshControlResponse>;
}
