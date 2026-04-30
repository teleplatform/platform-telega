function normalizeWhitespace(text) {
    return text.replace(/\s+/g, " ").trim();
}
function splitSentences(text) {
    return text
        .split(/(?<=[.!?…])\s+/u)
        .map((part) => part.trim())
        .filter(Boolean);
}
function getMaxWords(depth) {
    if (depth === "brief") {
        return 18;
    }
    if (depth === "deep") {
        return 55;
    }
    return 32;
}
function getMaxSentences(depth) {
    if (depth === "brief") {
        return 2;
    }
    if (depth === "deep") {
        return 4;
    }
    return 3;
}
function trimToWordLimit(text, maxWords) {
    const words = normalizeWhitespace(text).split(" ").filter(Boolean);
    if (words.length <= maxWords) {
        return normalizeWhitespace(text);
    }
    const trimmed = words.slice(0, maxWords).join(" ").trim();
    return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
export function runVerbosityGuard(input) {
    const normalized = normalizeWhitespace(input.composed_response.text);
    const sentences = splitSentences(normalized);
    const maxWords = getMaxWords(input.composed_response.depth);
    const maxSentences = getMaxSentences(input.composed_response.depth);
    let revisedText = normalized;
    if (sentences.length > maxSentences) {
        revisedText = sentences.slice(0, maxSentences).join(" ").trim();
    }
    revisedText = trimToWordLimit(revisedText, maxWords);
    const revisedSentences = splitSentences(revisedText);
    const revisedWords = revisedText.split(" ").filter(Boolean).length;
    const ok = revisedSentences.length <= maxSentences && revisedWords <= maxWords;
    return {
        ok,
        reason: ok
            ? "response_verbosity_is_within_limits"
            : "response_verbosity_required_trimming",
        revised_text: revisedText,
    };
}
//# sourceMappingURL=verbosityGuard.js.map