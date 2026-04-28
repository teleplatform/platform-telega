// @ts-nocheck
export function getMakerIds() {
    const raw = (process.env.PANTHEON_MAKER_IDS || "").trim();
    if (!raw)
        return new Set();
    return new Set(raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean));
}
export function isMaker(userId, isPrivateChat) {
    const makers = getMakerIds();
    if (makers.size === 0)
        return isPrivateChat;
    return makers.has(String(userId));
}
