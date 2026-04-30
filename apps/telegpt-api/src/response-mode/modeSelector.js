export function selectMode(relationship, intent, attention) {
    if (relationship.relationship_state === "sensitive_support_mode") {
        return "supportive";
    }
    if (intent.intent === "direction") {
        return "guiding";
    }
    if (attention.response_shape.branching === "low" &&
        attention.response_shape.depth === "low") {
        return "concise";
    }
    return "grounding";
}
//# sourceMappingURL=modeSelector.js.map