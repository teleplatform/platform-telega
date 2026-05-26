export interface CrossNodeTraceId {
  rootTraceId: string;
  spanId: string;
  parentSpanId?: string;
  traceState: string;
  traceFlags: number;
}

export function generateCrossNodeTraceId(
  rootTraceId: string,
  parentSpanId?: string
): CrossNodeTraceId {
  const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    rootTraceId,
    spanId,
    parentSpanId,
    traceState: '',
    traceFlags: 0,
  };
}

export function isValidTraceId(traceId: string): boolean {
  return traceId.startsWith('trace_') || traceId.startsWith('span_');
}

export function extractRootTraceId(traceId: string): string {
  if (traceId.startsWith('span_')) {
    // In a real implementation, this would look up the parent chain
    // For now, we'll assume the root is stored in metadata or we return a placeholder
    return traceId.split('_')[1] + '_' + traceId.split('_')[2]; // Simplified
  }
  return traceId;
}