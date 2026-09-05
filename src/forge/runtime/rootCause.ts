import { RuntimeSnapshot, RootCauseResult, Confidence, FrameInfo } from "./runtimeTypes";

const NULL_PATTERNS = ["null", "undefined", "NaN", "nil", "None", "nullptr"];

function analyzeFrameForRootCause(
  frame: FrameInfo,
  exception: string | null,
  exceptionType: string | null
): { cause: string; confidence: Confidence; evidence: string[] } | null {
  const evidence: string[] = [];

  // Check for null/undefined variables
  const nullVars = frame.variables.filter(
    (v) => NULL_PATTERNS.includes(v.value) || v.value === ""
  );

  if (nullVars.length > 0) {
    const names = nullVars.map((v) => v.name).join(", ");
    evidence.push(`Null/undefined variables in ${frame.name}: ${names}`);

    // If exception is TypeError and we have null vars — high confidence
    if (exception?.includes("TypeError") && nullVars.length > 0) {
      const likelyRoot = nullVars.find((v) => {
        const frameLower = frame.name.toLowerCase();
        return frameLower.includes(v.name.toLowerCase()) ||
               (exception?.toLowerCase().includes(v.name.toLowerCase()) ?? false);
      });
      if (likelyRoot) {
        return {
          cause: `Undefined parameter \`${likelyRoot.name}\` in ${frame.name}`,
          confidence: "high",
          evidence: [
            `Exception: ${exception}`,
            `Variable \`${likelyRoot.name}\` = ${likelyRoot.value} (${likelyRoot.type})`,
            `at ${frame.file}:${frame.line}`,
          ],
        };
      }
      return {
        cause: `TypeError caused by null/undefined variable(s): ${names}`,
        confidence: "high",
        evidence,
      };
    }
  }

  // Check for empty values
  const emptyVars = frame.variables.filter(
    (v) => v.value === '""' || v.value === "''" || v.value === "[]" || v.value === "{}"
  );
  if (emptyVars.length > 0 && exception) {
    evidence.push(`Empty values in ${frame.name}: ${emptyVars.map((v) => v.name).join(", ")}`);
  }

  // If we have an exception but no specific variable match
  if (exception) {
    evidence.push(`Exception: ${exception}`);
    // Try to find the variable mentioned in the exception
    for (const v of frame.variables) {
      if (exception.toLowerCase().includes(v.name.toLowerCase())) {
        return {
          cause: `Suspicious variable \`${v.name}\` = ${v.value} (${v.type}) in ${frame.name}`,
          confidence: "medium",
          evidence: [`Exception: ${exception}`, `\`${v.name}\` = ${v.value}`],
        };
      }
    }
  }

  if (evidence.length > 0) {
    return {
      cause: `Potential issue in ${frame.name}`,
      confidence: "low",
      evidence,
    };
  }

  return null;
}

export function analyzeRootCause(snapshot: RuntimeSnapshot): RootCauseResult | null {
  if (snapshot.frames.length === 0) {
    return {
      rootCause: "No stack frames available",
      symbol: "unknown",
      file: "unknown",
      line: 0,
      confidence: "low",
      evidence: ["No debug information available"],
    };
  }

  // Analyze top 3 frames
  const topFrames = snapshot.frames.slice(0, 3);
  for (const frame of topFrames) {
    const result = analyzeFrameForRootCause(frame, snapshot.exception, snapshot.exceptionType);
    if (result) {
      return {
        rootCause: result.cause,
        symbol: frame.name,
        file: frame.file,
        line: frame.line,
        confidence: result.confidence,
        evidence: result.evidence,
      };
    }
  }

  // No specific cause found — return generic from top frame
  const top = snapshot.frames[0];
  return {
    rootCause: snapshot.exception
      ? `Unhandled ${snapshot.exceptionType || "error"}: ${snapshot.exception}`
      : `Failure in ${top.name}`,
    symbol: top.name,
    file: top.file,
    line: top.line,
    confidence: "low",
    evidence: snapshot.exception ? [snapshot.exception] : [],
  };
}
