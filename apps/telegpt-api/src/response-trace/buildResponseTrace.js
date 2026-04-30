export function buildResponseTrace(input) {
    const focus = input.attention_plan.primary_focus?.trim() ?? "unknown";
    const relationship = input.relationship_plan.relationship_state?.trim() ?? "unknown";
    const intent = input.intent_plan.intent;
    const mode = input.mode_plan.mode;
    const structure = input.composed_response.structure;
    const depth = input.composed_response.depth;
    const qualityStatus = input.quality_result.status;
    const qualityScore = input.quality_result.score;
    const surface = input.surface_result.surface;
    const deliveryMode = input.delivery_mode;
    const payloadShape = "text_first";
    const voiceEnabled = true;
    const summary = [
        `focus=${focus}`,
        `relationship=${relationship}`,
        `intent=${intent}`,
        `mode=${mode}`,
        `structure=${structure}`,
        `depth=${depth}`,
        `quality=${qualityStatus}:${qualityScore}`,
        `surface=${surface}`,
        `delivery=${deliveryMode}`,
        `voice=${voiceEnabled}`,
    ].join("; ");
    return {
        attention_focus: focus,
        relationship_state: relationship,
        intent,
        mode,
        response_structure: structure,
        response_depth: depth,
        quality_status: qualityStatus,
        quality_score: qualityScore,
        surface,
        delivery_mode: deliveryMode,
        payload_shape: payloadShape,
        voice_enabled: voiceEnabled,
        trace_reason_summary: summary,
    };
}
//# sourceMappingURL=buildResponseTrace.js.map