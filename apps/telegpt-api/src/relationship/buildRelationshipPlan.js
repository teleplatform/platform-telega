export function buildRelationshipPlan(input) {
    const text = input.raw_input?.text ?? "";
    const lowerText = text.toLowerCase();
    if (lowerText.includes("поддержк") ||
        lowerText.includes("спокойн") ||
        lowerText.includes("тяжело") ||
        lowerText.includes("страшно")) {
        return { relationship_state: "sensitive_support_mode" };
    }
    return { relationship_state: "neutral" };
}
//# sourceMappingURL=buildRelationshipPlan.js.map