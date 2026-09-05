import { RuntimeSnapshot, FrameInfo } from "./runtimeTypes";
import { inspectCrash } from "../dap/runtimeInspector";

export async function captureRuntimeSnapshot(sessionId: string): Promise<RuntimeSnapshot> {
  const crash = await inspectCrash(sessionId);
  const now = Date.now();

  let exception: string | null = null;
  let exceptionType: string | null = null;

  if (crash.exceptionMessage) {
    exception = crash.exceptionMessage;
    // Infer exception type from message
    if (exception.includes("TypeError")) exceptionType = "TypeError";
    else if (exception.includes("ReferenceError")) exceptionType = "ReferenceError";
    else if (exception.includes("SyntaxError")) exceptionType = "SyntaxError";
    else if (exception.includes("RangeError")) exceptionType = "RangeError";
    else if (exception.includes("Error")) exceptionType = "Error";
    else exceptionType = "Unknown";
  }

  const frames: FrameInfo[] = crash.stackFrames.map((f) => ({
    name: f.name,
    file: f.file,
    line: f.line,
    variables: crash.topFrameVariables.map((v) => ({
      name: v.name,
      value: v.value,
      type: v.type,
    })),
  }));

  return {
    sessionId,
    exception,
    exceptionType,
    frames,
    timestamp: now,
  };
}

export function createSnapshotFromData(
  sessionId: string,
  exception: string | null,
  frames: FrameInfo[]
): RuntimeSnapshot {
  let exceptionType: string | null = null;
  if (exception) {
    if (exception.includes("TypeError")) exceptionType = "TypeError";
    else if (exception.includes("ReferenceError")) exceptionType = "ReferenceError";
    else if (exception.includes("SyntaxError")) exceptionType = "SyntaxError";
    else if (exception.includes("RangeError")) exceptionType = "RangeError";
    else if (exception.includes("Error")) exceptionType = "Error";
    else exceptionType = "Unknown";
  }

  return { sessionId, exception, exceptionType, frames, timestamp: Date.now() };
}
