export function determineDepth(attention) {
    if (attention.response_shape.branching === "low" &&
        attention.response_shape.depth === "low") {
        return "brief";
    }
    if (attention.response_shape.depth === "medium_high") {
        return "deep";
    }
    return "medium";
}
//# sourceMappingURL=brevityController.js.map