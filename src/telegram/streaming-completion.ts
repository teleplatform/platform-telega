export interface StreamingConfig {
  stableCheckIntervalMs: number;
  stableThreshold: number;
  minWaitMs: number;
  maxWaitMs: number;
  minLengthThreshold: number;
}

export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  stableCheckIntervalMs: 500,
  stableThreshold: 4,
  minWaitMs: 3000,
  maxWaitMs: 90000,
  minLengthThreshold: 1000,
};

export interface ExtractionState {
  status: "waiting" | "stable" | "completed" | "timeout";
  text: string;
  previousText: string;
  stableCount: number;
  startTime: number;
  lastUpdateTime: number;
  attempts: number;
}

export function createExtractionState(): ExtractionState {
  return {
    status: "waiting",
    text: "",
    previousText: "",
    stableCount: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
    attempts: 0,
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
} {
  const now = Date.now();
  const elapsed = now - state.startTime;
  const timeSinceUpdate = now - state.lastUpdateTime;

  if (state.status === "completed" || state.status === "timeout") {
    return {
      complete: true,
      status: state.status,
      text: state.text,
      reason: "already " + state.status,
    };
  }

  if (elapsed > config.maxWaitMs) {
    state.status = "timeout";
    return {
      complete: true,
      status: "timeout",
      text: currentText,
      reason: "max timeout reached",
    };
  }

  if (elapsed < config.minWaitMs) {
    state.previousText = currentText;
    return {
      complete: false,
      status: "waiting",
      text: currentText,
      reason: "min wait not reached",
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
    if (currentText.length < config.minLengthThreshold && elapsed < config.maxWaitMs * 0.5) {
      state.previousText = currentText;
      return {
        complete: false,
        status: "waiting",
        text: currentText,
        reason: "text too short, waiting more",
      };
    }

    state.status = "completed";
    state.text = currentText;
    return {
      complete: true,
      status: "completed",
      text: currentText,
      reason: "text stable",
    };
  }

  return {
    complete: false,
    status: "waiting",
    text: currentText,
    reason: `stable count ${state.stableCount}/${config.stableThreshold}`,
  };
}

export async function waitForStableText(
  getText: () => Promise<string>,
  config: StreamingConfig = DEFAULT_STREAMING_CONFIG,
  onProgress?: (state: ExtractionState) => void
): Promise<string> {
  const state = createExtractionState();

  while (true) {
    const currentText = await getText();
    
    onProgress?.(state);

    const result = checkStreamingComplete(state, currentText, config);

    if (result.complete) {
      await logExtractionEvent("extraction_completed", {
        status: result.status,
        text_length: result.text.length,
        attempts: state.attempts,
        reason: result.reason,
      });
      return result.text;
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