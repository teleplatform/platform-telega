import type { ControlCommandRequest, ControlCommandResult } from './control-types.js';
import { emitMissionControlLiveEvent } from '../hooks/mission-control-live-feed-hook.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';

export async function handleBrowserCommand(req: ControlCommandRequest): Promise<ControlCommandResult> {
  const { command } = req;

  switch (command) {
    case 'list_sessions': {
      try {
        const { listSessions, sessionStats } = await import('../browser/browser-session-manager.js');
        const { getAllBrowserTasks } = await import('../browser/browser-task-queue.js');
        const { getConcurrentRunnerStatus } = await import('../browser/browser-concurrent-runner.js');
        const { getCleanerStats } = await import('../browser/browser-dead-session-cleaner.js');

        const sessions = listSessions();
        const stats = sessionStats();
        const tasks = getAllBrowserTasks();
        const runner = getConcurrentRunnerStatus();
        const cleaner = getCleanerStats();

        return {
          ok: true, command,
          message: `${sessions.length} sessions (${stats.active} active, ${stats.idle} idle), ` +
            `${tasks.length} tasks, runner: ${runner?.running ? 'active' : 'stopped'}`,
          data: {
            sessions: sessions.map((s: any) => ({ id: s.id, label: s.label, status: s.status, createdAt: s.createdAt })),
            stats,
            tasks: tasks.length,
            runner,
            cleaner
          } as unknown as Record<string, unknown>
        };
      } catch (e: any) {
        return { ok: false, command, message: 'Browser runtime not available', error: e.message };
      }
    }

    case 'clear_sessions': {
      try {
        const { closeAllSessions } = await import('../browser/browser-session-manager.js');
        const { runCleaner, getCleanerStats } = await import('../browser/browser-dead-session-cleaner.js');

        const cleaned = runCleaner();
        await closeAllSessions();

        await emitMissionControlLiveEvent({
          kind: 'execution_completed',
          severity: 'low',
          title: `Cleared browser sessions`,
          payload: { cleaned }
        });

        return {
          ok: true, command,
          message: `Cleaned ${cleaned.cleaned} sessions, closed all remaining`,
          data: { cleaned: cleaned.cleaned, reasons: cleaned.reasons }
        };
      } catch (e: any) {
        return { ok: false, command, message: 'Failed to clear sessions', error: e.message };
      }
    }

    default:
      return { ok: false, command, message: `Unknown browser command: ${command}`, error: 'unknown_command' };
  }
}
