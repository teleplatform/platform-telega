export function createInitialState(trace_id, session_id, actor_id, actor_role, channel, raw_input) {
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
//# sourceMappingURL=orchestrationState.js.map