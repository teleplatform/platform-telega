export function buildPresencePlan(input) {
    const isSupport = input.relationship_plan.relationship_state === "sensitive_support_mode";
    if (isSupport) {
        return {
            micro_ack: "Понял.",
            chunks: [{ text: "Я рядом. Можно спокойно пойти шаг за шагом." }],
        };
    }
    return {
        micro_ack: "Принял.",
        chunks: [{ text: `Фокус: ${input.attention_plan.primary_focus}.` }],
    };
}
//# sourceMappingURL=buildPresencePlan.js.map