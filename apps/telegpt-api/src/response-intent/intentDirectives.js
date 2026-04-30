const DIRECTIVE_MAP = {
    support: "reduce pressure, sound calm, emotionally stabilize, do not push",
    direction: "move forward, state the next correct step, keep momentum",
    clarify: "narrow ambiguity, ask the most useful clarification, keep it light",
    stabilize: "hold the main focus, keep the answer grounded, avoid drift",
};
const RATIONALE_MAP = {
    support: "relationship signals sensitive support mode",
    direction: "attention signals next correct step",
    clarify: "attention signals need for clarification first",
    stabilize: "default mode, no urgent support or direction signals",
};
export function getIntentDirective(intent) {
    return DIRECTIVE_MAP[intent] ?? DIRECTIVE_MAP.stabilize;
}
export function getIntentRationale(intent) {
    return RATIONALE_MAP[intent] ?? RATIONALE_MAP.stabilize;
}
//# sourceMappingURL=intentDirectives.js.map