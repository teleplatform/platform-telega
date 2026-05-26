import type { MeshControlRequest, MeshControlResponse } from './mesh-control-types.js';
import { registerMeshControlHandler } from './mesh-control-router.js';

export async function handleSyncEvidenceCommand(request: MeshControlRequest): Promise<MeshControlResponse> {
  const evidenceId = request.target || (request.parameters?.evidenceId as string);
  if (!evidenceId) {
    return {
      command: 'sync_evidence',
      success: false,
      error: 'evidenceId is required',
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  }

  // Placeholder – in real system this would trigger EvidenceIngestService
  return {
    command: 'sync_evidence',
    success: true,
    data: {
      evidenceId,
      status: 'sync_initiated',
      message: 'Evidence sync triggered (implementation pending full integration)',
    },
    executedAt: Date.now(),
    actorId: request.actorId,
  };
}

registerMeshControlHandler({
  command: 'sync_evidence',
  handle: handleSyncEvidenceCommand,
});
