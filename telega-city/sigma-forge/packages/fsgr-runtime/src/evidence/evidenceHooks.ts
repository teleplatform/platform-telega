export function emitEvidenceSnapshot(runId: string, kind: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    evidence_id: `evidence_${runId}_${kind}`,
    run_id: runId,
    kind,
    payload,
    timestamp: new Date().toISOString(),
  };
}
