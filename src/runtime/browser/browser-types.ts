export type BrowserActionType = "browser_navigate" | "browser_click" | "browser_type" | "browser_screenshot" | "browser_extract" | "browser_wait";

export interface BrowserActionResult {
  url?: string;
  title?: string;
  text?: string;
  htmlSnippet?: string;
  screenshotPath?: string;
  elementFound?: boolean;
  waitResult?: boolean;
}

export interface BrowserSessionState {
  launched: boolean;
  pageCount: number;
  lastUrl?: string;
  lastAction?: string;
  errorCount: number;
}

export interface BrowserEvidence {
  kind: "screenshot" | "page_source" | "text_content";
  path?: string;
  content?: string;
  timestamp: number;
}

export interface VerificationCondition {
  kind: "title_contains" | "url_contains" | "element_exists" | "text_contains" | "text_not_contains";
  target: string;
  selector?: string;
}

export interface BrowserStep {
  id: string;
  type: BrowserActionType;
  label: string;
  params: Record<string, unknown>;
  verify?: VerificationCondition[];
  onFail?: "stop" | "continue" | "retry";
  maxRetries?: number;
}

export interface BrowserPlan {
  id: string;
  intent: string;
  steps: BrowserStep[];
  screenshotEvery?: boolean;
}

export interface VerificationResult {
  condition: VerificationCondition;
  passed: boolean;
  actual: string;
}

export interface BrowserStepResult {
  stepId: string;
  label: string;
  actionResult: BrowserActionResult;
  verified: boolean;
  verificationResults: VerificationResult[];
  evidence: BrowserEvidence[];
  error?: string;
  attempts: number;
}

export interface BrowserTaskResult {
  planId: string;
  intent: string;
  startedAt: number;
  completedAt: number;
  allVerified: boolean;
  stepResults: BrowserStepResult[];
  summary: string;
  screenshotPaths: string[];
}
