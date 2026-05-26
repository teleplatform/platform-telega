export type ControlCommand =
  | 'pause' | 'resume' | 'cancel' | 'retry'
  | 'list_sessions' | 'clear_sessions'
  | 'replay' | 'export_evidence'
  | 'list_artifacts' | 'open_artifact';

export interface ControlCommandRequest {
  command: ControlCommand;
  graphId?: string;
  nodeId?: string;
  artifactId?: string;
  params?: Record<string, unknown>;
}

export interface ControlCommandResult {
  ok: boolean;
  command: ControlCommand;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}
