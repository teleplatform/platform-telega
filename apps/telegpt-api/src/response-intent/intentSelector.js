export function selectIntent(attention, relationship) {
    if (relationship.relationship_state === "sensitive_support_mode") {
        return "support";
    }
    if (attention.response_shape.lead_with === "next_correct_step") {
        return "direction";
    }
    if (attention.response_shape.lead_with === "clarify_first") {
        return "clarify";
    }
    return "stabilize";
}
//# sourceMappingURL=intentSelector.js.map