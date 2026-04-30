function hasQuestion(text) {
    return text.includes("?");
}
function hasDirectionalPhrase(text) {
    return (text.includes("следующий правильный шаг") ||
        text.includes("следующий шаг") ||
        text.includes("суть") ||
        text.includes("уточни"));
}
function hasSupportPhrase(text) {
    return (text.includes("я рядом") ||
        text.includes("спокойно") ||
        text.includes("можно") ||
        text.includes("не нужно"));
}
export function runValueGuard(input) {
    const text = input.composed_response.text.toLowerCase().trim();
    if (!text) {
        return {
            ok: false,
            reason: "empty_response_has_no_value",
        };
    }
    if (input.composed_response.structure === "single_line_ack") {
        return {
            ok: hasQuestion(text) || text.includes("уточни"),
            reason: hasQuestion(text) || text.includes("уточни")
                ? "clarifying_value_present"
                : "clarifying_response_has_no_clear_question",
        };
    }
    if (input.composed_response.structure === "next_step_forward") {
        return {
            ok: hasDirectionalPhrase(text),
            reason: hasDirectionalPhrase(text)
                ? "directional_value_present"
                : "next_step_response_has_no_direction",
        };
    }
    if (input.composed_response.structure === "supportive_elaboration") {
        return {
            ok: hasSupportPhrase(text),
            reason: hasSupportPhrase(text)
                ? "supportive_value_present"
                : "supportive_response_feels_empty",
        };
    }
    return {
        ok: hasDirectionalPhrase(text) || hasSupportPhrase(text),
        reason: hasDirectionalPhrase(text) || hasSupportPhrase(text)
            ? "core_value_present"
            : "neutral_response_has_no_clear_value",
    };
}
//# sourceMappingURL=valueGuard.js.map