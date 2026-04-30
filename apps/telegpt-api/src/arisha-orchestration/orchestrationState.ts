import type { ArishaOrchestrationState } from "./types.js";

export function createInitialState(
  trace_id: string,
  session_id: string,
  actor_id: string,
  actor_role: string,
  channel: string,
  raw_input: { text: string },
): ArishaOrchestrationState {
  return {
    trace_id,
    session_id,
    actor_id,
    actor_role,
    channel,
    raw_input,
    context_pack: null,
    attention_plan: { primary_focus: "", response_shape: { lead_with: "", branching: "", depth: "" } },
    relationship_plan: { relationship_state: "" },
    presence_plan: { micro_ack: "", chunks: [] },
    intent_plan: null,
    mode_plan: null,
    response_trace: null,
    voice_request: null,
    surface_reply: null,
    errors: [],
  };
}
