function normalizeWhitespace(text) {
    return text.replace(/\s+/g, " ").trim();
}
function splitSentences(text) {
    return text
        .split(/(?<=[.!?…])\s+/u)
        .map((part) => part.trim())
        .filter(Boolean);
}
export function adaptForTelegram(text) {
    const normalized = normalizeWhitespace(text);
    const sentences = splitSentences(normalized);
    if (sentences.length > 2) {
        const trimmed = sentences.slice(0, 2).join(" ").trim();
        return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
    }
    return normalized;
}
//# sourceMappingURL=telegramAdapter.js.map