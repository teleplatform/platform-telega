import type { ControlCommandRequest, ControlCommandResult } from './control-types.js';
import { handleGraphCommand, handleReplayCommand, handleExportEvidenceCommand } from './control-graph.js';
import { handleBrowserCommand } from './control-browser.js';
import { handleArtifactCommand } from './control-artifacts.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';

const GRAPH_COMMANDS = new Set(['pause', 'resume', 'cancel', 'retry']);
const BROWSER_COMMANDS = new Set(['list_sessions', 'clear_sessions']);
const EVIDENCE_COMMANDS = new Set(['replay', 'export_evidence']);
const ARTIFACT_COMMANDS = new Set(['list_artifacts', 'open_artifact']);

export async function routeControlCommand(req: ControlCommandRequest): Promise<ControlCommandResult> {
  const { command } = req;

  if (GRAPH_COMMANDS.has(command)) {
    return handleGraphCommand(req);
  }
  if (BROWSER_COMMANDS.has(command)) {
    return handleBrowserCommand(req);
  }
  if (EVIDENCE_COMMANDS.has(command)) {
    if (command === 'replay') return handleReplayCommand(req);
    if (command === 'export_evidence') return handleExportEvidenceCommand(req);
  }
  if (ARTIFACT_COMMANDS.has(command)) {
    return handleArtifactCommand(req);
  }

  return { ok: false, command, message: `Unknown command: ${command}`, error: 'unknown_command' };
}

export async function executeCommand(commandStr: string, graphId?: string, nodeId?: string): Promise<ControlCommandResult> {
  const command = parseCommandString(commandStr);
  if (!command) {
    return { ok: false, command: commandStr as any, message: `Invalid command: ${commandStr}`, error: 'parse_error' };
  }

  const req: ControlCommandRequest = { command, graphId, nodeId };

  const result = await routeControlCommand(req);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(command, 'control_command_executed'),
    trace_id: graphId ?? command,
    job_id: 'control_router',
    type: 'execution_completed',
    timestamp: new Date().toISOString(),
    payload: {
      command: result.command,
      ok: result.ok,
      message: result.message,
      graphId,
      nodeId
    }
  });

  return result;
}

function parseCommandString(input: string): string | null {
  const cleaned = input.replace(/^\//, '').replace(/^control_/, '');
  const validCommands = [
    'pause', 'resume', 'cancel', 'retry',
    'list_sessions', 'clear_sessions',
    'replay', 'export_evidence',
    'list_artifacts', 'open_artifact'
  ];
  if (validCommands.includes(cleaned)) return cleaned;
  return null;
}
