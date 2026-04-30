function capitalizeFirst(text) {
    if (!text) {
        return text;
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
}
function normalizeSentence(text) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) {
        return "";
    }
    return /[.!?…]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}
function buildNextStepBody(attention, depth, mode) {
    if (depth === "brief") {
        return "Следующий правильный шаг — двигаться дальше по текущей линии без распыления.";
    }
    if (depth === "deep") {
        return `Следующий правильный шаг — удержать главный фокус на теме "${attention.primary_focus}" и собирать ответ вокруг неё, не уводя разговор во второстепенные ветки.`;
    }
    return `Следующий правильный шаг — идти дальше по главной линии: ${attention.primary_focus}.`;
}
function buildNeutralBody(attention, depth) {
    if (depth === "brief") {
        return `Суть в этом: ${attention.primary_focus}.`;
    }
    if (depth === "deep") {
        return `Суть сейчас в главном фокусе: ${attention.primary_focus}. Вторичный контекст можно держать рядом, но не давать ему размывать ответ.`;
    }
    return `Суть сейчас в этом: ${attention.primary_focus}.`;
}
function buildClarifyBody() {
    return "Уточни, что именно нужно раскрыть первым.";
}
export function planResponseSegments(input) {
    const ack = normalizeSentence(capitalizeFirst(input.presence_plan.micro_ack));
    const presenceText = normalizeSentence(input.presence_plan.chunks[0]?.text ?? "");
    if (input.mode_plan.mode === "supportive") {
        if (input.structure === "supportive_elaboration") {
            return [presenceText];
        }
        return [`${ack} Можно спокойно пойти шаг за шагом.`];
    }
    if (input.intent_plan.intent === "direction") {
        return [
            ack,
            buildNextStepBody(input.attention_plan, input.depth, input.mode_plan),
        ];
    }
    if (input.intent_plan.intent === "clarify") {
        return [ack, buildClarifyBody()];
    }
    if (input.mode_plan.mode === "concise") {
        return [ack, buildNeutralBody(input.attention_plan, "brief")];
    }
    return [ack, buildNeutralBody(input.attention_plan, input.depth)];
}
//# sourceMappingURL=segmentPlanner.js.map