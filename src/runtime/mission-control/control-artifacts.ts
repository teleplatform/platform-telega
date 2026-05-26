import type { ControlCommandRequest, ControlCommandResult } from './control-types.js';

export async function handleArtifactCommand(req: ControlCommandRequest): Promise<ControlCommandResult> {
  const { command, artifactId } = req;

  switch (command) {
    case 'list_artifacts': {
      try {
        const { getAllArtifacts } = await import('../browser/browser-artifact-registry.js');
        const artifacts = getAllArtifacts();

        if (artifacts.length === 0) {
          return { ok: true, command, message: 'No artifacts registered' };
        }

        const byKind = new Map<string, { count: number; totalSize: number }>();
        for (const a of artifacts) {
          if (!byKind.has(a.kind)) byKind.set(a.kind, { count: 0, totalSize: 0 });
          const entry = byKind.get(a.kind)!;
          entry.count++;
          entry.totalSize += a.size;
        }

        const summary = Array.from(byKind.entries()).map(([kind, info]) =>
          `${kind}: ${info.count} (${formatSize(info.totalSize)})`
        ).join(', ');

        return {
          ok: true, command,
          message: `${artifacts.length} artifacts: ${summary}`,
          data: {
            total: artifacts.length,
            artifacts: artifacts.slice(0, 20).map((a: any) => ({
              id: a.id, kind: a.kind, path: a.path, size: a.size, taskIntent: a.taskIntent
            })),
            summary
          } as unknown as Record<string, unknown>
        };
      } catch (e: any) {
        return { ok: false, command, message: 'Failed to list artifacts', error: e.message };
      }
    }

    case 'open_artifact': {
      if (!artifactId) {
        return { ok: false, command, message: 'artifactId is required', error: 'missing artifactId' };
      }

      try {
        const { getArtifact } = await import('../browser/browser-artifact-registry.js');
        const artifact = getArtifact(artifactId);

        if (!artifact) {
          return { ok: false, command, message: `Artifact ${artifactId} not found`, error: 'not_found' };
        }

        return {
          ok: true, command,
          message: `Artifact: ${artifact.id} (${artifact.kind}, ${formatSize(artifact.size)})`,
          data: {
            id: artifact.id,
            kind: artifact.kind,
            path: artifact.path,
            size: artifact.size,
            hash: artifact.hash,
            taskIntent: artifact.taskIntent,
            stepLabel: artifact.stepLabel,
            registeredAt: artifact.registeredAt
          } as unknown as Record<string, unknown>
        };
      } catch (e: any) {
        return { ok: false, command, message: 'Failed to open artifact', error: e.message };
      }
    }

    default:
      return { ok: false, command, message: `Unknown artifact command: ${command}`, error: 'unknown_command' };
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
