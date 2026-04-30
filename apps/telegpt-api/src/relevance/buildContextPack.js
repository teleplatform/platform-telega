export function buildContextPack(input) {
    return {
        raw_text: input.raw_input?.text ?? "",
        actor_role: input.actor_role,
        channel: input.channel,
        language: "ru",
    };
}
//# sourceMappingURL=buildContextPack.js.map