export interface ArishaPipelineRequest {
  trace_id: string;
  session_id: string;
  actor_id: string;
  actor_role: string;
  channel: string;
  raw_input: {
    text: string;
  };
}

export interface ArishaOrchestrationState {
  trace_id: string;
  session_id: string;
  actor_id: string;
  actor_role: string;
  channel: string;
  raw_input: { text: string };
  context_pack: any;
  attention_plan: AttentionPlan;
  relationship_plan: RelationshipPlan;
  presence_plan: PresencePlan;
  intent_plan: any;
  mode_plan: any;
  response_trace: any;
  voice_request: any;
  surface_reply: SurfaceReply | null;
  errors: Array<{ stage: string; message: string }>;
}

export interface AudioOutput {
  asset_id: string;
  file_path?: string;
  filename?: string;
  mime?: string;
  size_bytes?: number;
  provider: string;
  duration_ms?: number;
}

export interface SurfaceReply {
  channel: string;
  text_output: string;
  audio_output?: AudioOutput;
  payload_shape: string;
  fallback_used: boolean;
}

export interface AttentionPlan {
  primary_focus: string;
  response_shape: {
    lead_with: string;
    branching: string;
    depth: string;
  };
}

export interface RelationshipPlan {
  relationship_state: string;
}

export interface PresencePlan {
  micro_ack: string;
  chunks: Array<{ text: string }>;
}
