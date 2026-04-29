export interface StreamingConfig {
  stableCheckIntervalMs: number;
  stableThreshold: number;
  minWaitMs: number;
  maxWaitMs: number;
  minLengthThreshold: number;
  longPromptMinWaitMs: number;
  longPromptMinLengthChars: number;
  growthWindowMs: number;
}

export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  stableCheckIntervalMs: 500,
  stableThreshold: 4,
  minWaitMs: 5000,
  maxWaitMs: 90000,
  minLengthThreshold: 1000,
  longPromptMinWaitMs: 25000,
  longPromptMinLengthChars: 2500,
  growthWindowMs: 10000,
};

const LONG_PROMPT_KEYWORDS = [
  "3000",
  "4000",
  "5000",
  "слов",
  "words",
  "article",
  "статья",
  "long",
  "подробно",
  "развернуто",
  "detailed",
  "comprehensive",
  "essay",
  "research",
];

function isLongPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return LONG_PROMPT_KEYWORDS.some((kw) => lower.includes(kw));
}

function getMinLength(prompt: string, defaultThreshold: number): number {
  return isLongPrompt(prompt) ? 2500 : defaultThreshold;
}

function getMinWait(prompt: string, defaultWait: number, longWait: number): number {
  return isLongPrompt(prompt) ? longWait : defaultWait;
}

export interface ExtractionState {
  status: "waiting" | "stable" | "completed" | "timeout" | "partial";
  text: string;
  previousText: string;
  stableCount: number;
  startTime: number;
  lastUpdateTime: number;
  firstTextTime: number;
  attempts: number;
  prompt: string;
}

export function createExtractionState(prompt: string = ""): ExtractionState {
  return {
    status: "waiting",
    text: "",
    previousText: "",
    stableCount: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
    firstTextTime: 0,
    attempts: 0,
    prompt,
  };
}

export function checkStreamingComplete(
  state: ExtractionState,
  currentText: string,
  config: StreamingConfig = DEFAULT_STREAMING_CONFIG
): {
  complete: boolean;
  status: ExtractionState["status"];
  text: string;
  reason: string;
  metadata?: Record<string, any>;
} {
  const now = Date.now();
  const elapsed = now - state.startTime;
  const timeSinceUpdate = now - state.lastUpdateTime;

  if (state.firstTextTime === 0 && currentText.length > 0) {
    state.firstTextTime = now;
  }

  const minLength = getMinLength(state.prompt, config.minLengthThreshold);
  const minWait = getMinWait(state.prompt, config.minWaitMs, config.longPromptMinWaitMs);
  const hasGrowthWindow = state.firstTextTime > 0 && (now - state.firstTextTime) < config.growthWindowMs;

  if (state.status === "completed" || state.status === "timeout" || state.status === "partial") {
    return {
      complete: true,
      status: state.status,
      text: state.text,
      reason: "already " + state.status,
      metadata: { minLength, minWait, elapsed },
    };
  }

  if (elapsed > config.maxWaitMs) {
    const isTooShort = currentText.length < minLength;
    if (isTooShort) {
      state.status = "partial";
      state.text = currentText;
      return {
        complete: true,
        status: "partial",
        text: currentText,
        reason: "timeout but PARTIAL: " + currentText.length + " < " + minLength,
        metadata: { extracted_length: currentText.length, min_expected: minLength },
      };
    }
    state.status = "timeout";
    return {
      complete: true,
      status: "timeout",
      text: currentText,
      reason: "max timeout reached",
      metadata: { elapsed, extracted_length: currentText.length },
    };
  }

  if (elapsed < minWait) {
    state.previousText = currentText;
    return {
      complete: false,
      status: "waiting",
      text: currentText,
      reason: "min wait not reached: " + elapsed + " < " + minWait,
      metadata: { minWait, elapsed },
    };
  }

  if (hasGrowthWindow) {
    state.previousText = currentText;
    return {
      complete: false,
      status: "waiting",
      text: currentText,
      reason: "growth window active: " + (config.growthWindowMs - (now - state.firstTextTime)) + "ms left",
      metadata: { growthWindowRemaining: config.growthWindowMs - (now - state.firstTextTime) },
    };
  }

  if (currentText.length < minLength) {
    state.previousText = currentText;
    return {
      complete: false,
      status: "waiting",
      text: currentText,
      reason: "too short: " + currentText.length + " < " + minLength,
      metadata: { current_length: currentText.length, min_expected: minLength },
    };
  }

  if (currentText === state.previousText) {
    state.stableCount++;
  } else {
    state.stableCount = 0;
    state.previousText = currentText;
  }

  state.lastUpdateTime = now;
  state.attempts++;

  if (state.stableCount >= config.stableThreshold) {
    state.status = "completed";
    state.text = currentText;
    return {
      complete: true,
      status: "completed",
      text: currentText,
      reason: "text stable",
      metadata: {
        extracted_length: currentText.length,
        min_expected: minLength,
        wait_duration_ms: elapsed,
        attempts: state.attempts,
      },
    };
  }

  return {
    complete: false,
    status: "waiting",
    text: currentText,
    reason: "stable count " + state.stableCount + "/" + config.stableThreshold,
    metadata: { stableCount: state.stableCount },
  };
}

export async function waitForStableText(
  getText: () => Promise<string>,
  prompt: string = "",
  config: StreamingConfig = DEFAULT_STREAMING_CONFIG,
  onProgress?: (state: ExtractionState) => void
): Promise<{ text: string; status: string; metadata?: Record<string, any> }> {
  const state = createExtractionState(prompt);

  while (true) {
    const currentText = await getText();
    
    onProgress?.(state);

    const result = checkStreamingComplete(state, currentText, config);

    await logExtractionEvent("extraction_check", {
      status: result.status,
      text_length: currentText.length,
      reason: result.reason,
    });

    if (result.complete) {
      await logExtractionEvent("extraction_completed", {
        status: result.status,
        text_length: result.text.length,
        attempts: state.attempts,
        reason: result.reason,
        ...(result.metadata || {}),
      });
      return { text: result.text, status: result.status, metadata: result.metadata };
    }

    await new Promise((r) => setTimeout(r, config.stableCheckIntervalMs));
  }
}

async function logExtractionEvent(event: string, data: object): Promise<void> {
  const DATA_DIR = process.cwd() + "/data";
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const file = path.join(DATA_DIR, "extraction-audit.jsonl");
    await fs.appendFile(file, JSON.stringify({ event, ...data, timestamp: Date.now() }) + "\n");
  } catch {}
}

export function isPartialOutput(text: string): boolean {
  if (!text || text.length < 10) return true;

  const truncationPatterns = [
    /continue$/i,
    /\.\.\.$/,
    /and then$/i,
    /so$/i,
  ];

  if (truncationPatterns.some((p) => p.test(text.trim()))) {
    return true;
  }

  return false;
}