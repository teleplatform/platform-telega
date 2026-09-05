export type LspKind =
  | "definition"
  | "references"
  | "hover"
  | "symbols"
  | "completion"
  | "documentSymbols";

export type LspLanguage =
  | "typescript"
  | "python"
  | "go"
  | "rust";

export type LspStatus =
  | "starting"
  | "running"
  | "errored"
  | "stopped";

export interface LspRequest {
  requestId: string;
  kind: LspKind;
  symbol?: string;
  query?: string;
  file?: string;
  line?: number;
  character?: number;
}

export interface LspLocation {
  uri: string;
  file: string;
  line: number;
  character: number;
}

export interface LspSymbolInfo {
  name: string;
  kind: string;
  file: string;
  line: number;
  containerName?: string;
  detail?: string;
}

export interface LspResult {
  ok: boolean;
  kind: LspKind;
  locations: LspLocation[];
  symbols?: LspSymbolInfo[];
  hoverContent?: string;
  error?: string;
}

export interface LspServerConfig {
  language: LspLanguage;
  command: string;
  args: string[];
  projectRoot: string;
}

export interface LspServerSession {
  language: LspLanguage;
  status: LspStatus;
  process: any;
  startedAt: number;
}
