const HARSH_PATTERNS = [
    /\bдолжен\b/iu,
    /\bобязан\b/iu,
    /\bнемедленно\b/iu,
    /\bпрекрати\b/iu,
    /\bуспокойся\b/iu,
];
export function runToneGuard(input) {
    const text = input.composed_response.text.trim();
    if (!text) {
        return {
            ok: false,
            reason: "empty_response_has_no_valid_tone",
        };
    }
    const hasHarshPattern = HARSH_PATTERNS.some((pattern) => pattern.test(text));
    if (hasHarshPattern) {
        return {
            ok: false,
            reason: "response_tone_is_too_harsh",
        };
    }
    if (input.relationship_plan.relationship_state === "sensitive_support_mode" &&
        text.includes("!")) {
        return {
            ok: false,
            reason: "sensitive_support_should_not_use_exclamation",
        };
    }
    const ack = input.presence_plan.micro_ack?.trim() ?? "";
    if (input.composed_response.structure !== "supportive_elaboration" &&
        ack &&
        !text.toLowerCase().includes(ack.toLowerCase())) {
        return {
            ok: false,
            reason: "response_lost_presence_ack",
        };
    }
    return {
        ok: true,
        reason: "response_tone_is_consistent",
    };
}
//# sourceMappingURL=toneGuard.js.map