export type DapLanguage = "node" | "python";

export type DapSessionStatus = "starting" | "running" | "paused" | "stopped" | "errored";

export type DapRequestKind =
  | "launch" | "attach" | "breakpoint" | "continue"
  | "step_over" | "step_into" | "step_out"
  | "stack" | "scopes" | "variables" | "evaluate"
  | "stop";

export interface DapBreakpoint {
  id: number;
  file: string;
  line: number;
  verified: boolean;
}

export interface DapStackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
  column: number;
}

export interface DapScope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

export interface DapVariable {
  name: string;
  value: string;
  type: string;
  variablesReference: number;
}

export interface DapLaunchConfig {
  language: DapLanguage;
  program: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface DapSession {
  id: string;
  language: DapLanguage;
  status: DapSessionStatus;
  launchConfig: DapLaunchConfig;
  process: any;
  startedAt: number;
  breakpoints: DapBreakpoint[];
  exceptionInfo: string | null;
}

export interface DapRequest {
  requestId: string;
  kind: DapRequestKind;
  sessionId?: string;
  file?: string;
  line?: number;
  expression?: string;
  variablesReference?: number;
  frameId?: number;
  launchConfig?: DapLaunchConfig;
}

export interface DapResult {
  ok: boolean;
  kind: DapRequestKind;
  sessionId?: string;
  breakpoints?: DapBreakpoint[];
  frames?: DapStackFrame[];
  scopes?: DapScope[];
  variables?: DapVariable[];
  evaluateResult?: string;
  exceptionInfo?: string;
  error?: string;
}

export interface CrashInspection {
  hasException: boolean;
  exceptionMessage: string | null;
  stackFrames: DapStackFrame[];
  topFrameVariables: DapVariable[];
  suspectedSymbol: string | null;
  suspectedFile: string | null;
  recommendedChecks: string[];
}
