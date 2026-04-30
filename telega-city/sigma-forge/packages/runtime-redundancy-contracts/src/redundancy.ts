export type TransportType = 'telegram' | 'web' | 'miniapp' | 'tgm' | 'max';
export type ChannelStatus = 'active' | 'degraded' | 'unavailable';
export type FailoverStatus = 'idle' | 'active' | 'completed' | 'failed' | 'rolled_back';
export type RecoveryStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RecoveryMethod = 'replay' | 'resend' | 'reconstruct' | 'manual_override';
export type TransportLossEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface TransportChannel {
  channel_id: string;
  transport: TransportType;
  identity_key: string;
  status: ChannelStatus;
  priority: number;
  last_heartbeat_at?: string;
  last_failure_at?: string;
  failure_reason?: string;
  updated_at: string;
}

export interface IdentityContinuityRecord {
  identity_id: string;
  transport_identity_key: string;
  transport: TransportType;
  canonical_user_id: string;
  session_id?: string;
  bound_at: string;
  updated_at: string;
}

export interface FailoverEvent {
  failover_id: string;
  mission_id?: string;
  session_id?: string;
  from_transport: TransportType;
  to_transport: TransportType;
  reason: string;
  status: FailoverStatus;
  started_at: string;
  completed_at?: string;
  result?: string;
}

export interface RecoveryRecord {
  recovery_id: string;
  mission_id?: string;
  session_id?: string;
  transport: TransportType;
  method: RecoveryMethod;
  status: RecoveryStatus;
  started_at: string;
  completed_at?: string;
  result_summary?: string;
  evidence_refs: string[];
}

export interface DeliveryEnvelope {
  delivery_id: string;
  mission_id?: string;
  target_transport: TransportType;
  fallback_transport?: TransportType;
  payload_ref: string;
  payload_summary: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'fallback_sent';
  attempt_count: number;
  created_at: string;
}

export interface TransportLossEvent {
  event_id: string;
  transport: TransportType;
  severity: TransportLossEventSeverity;
  reason: string;
  affected_missions: string[];
  detected_at: string;
}

export interface OperationalDegradationState {
  degradation_id: string;
  scope: 'transport' | 'department' | 'global';
  scope_id: string;
  active_transport: TransportType;
  lost_transports: TransportType[];
  degradation_mode: 'normal' | 'reduced_capacity' | 'local_only' | 'suspended';
  affected_operations: string[];
  activated_at: string;
  reason: string;
  status: 'active' | 'resolved';
}

export interface RedundancyAuditEvent {
  event_type: string;
  actor: string;
  transport?: TransportType;
  details: Record<string, unknown>;
  timestamp: string;
}
