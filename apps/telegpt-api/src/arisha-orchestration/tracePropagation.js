export function getTraceId(state) {
    return state.trace_id;
}
export function logWithTrace(stage, traceId, message) {
    console.log(`[${traceId}] ${stage}: ${message}`);
}
//# sourceMappingURL=tracePropagation.js.map