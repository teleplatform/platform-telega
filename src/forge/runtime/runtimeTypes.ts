export type Confidence = "high" | "medium" | "low";

export interface FrameInfo {
  name: string;
  file: string;
  line: number;
  variables: Array<{ name: string; value: string; type: string }>;
}

export interface RuntimeSnapshot {
  sessionId: string;
  exception: string | null;
  exceptionType: string | null;
  frames: FrameInfo[];
  timestamp: number;
}

export interface RootCauseResult {
  rootCause: string;
  symbol: string;
  file: string;
  line: number;
  confidence: Confidence;
  evidence: string[];
}

export interface FailureLink {
  from: string;
  fromFile: string;
  fromLine: number;
  to: string;
  toFile: string;
  toLine: number;
  reason: string;
}

export interface FailureChain {
  links: FailureLink[];
  root: RootCauseResult;
  depth: number;
}

export interface FixCandidate {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "null_check" | "validation" | "type_guard" | "error_handling" | "input_sanitization" | "state_reset";
  confidence: Confidence;
  codeSnippet?: string;
}

export interface RuntimeReport {
  rootCause: RootCauseResult;
  failureChain: FailureChain;
  candidates: FixCandidate[];
  snapshot: RuntimeSnapshot;
  generatedAt: number;
}
