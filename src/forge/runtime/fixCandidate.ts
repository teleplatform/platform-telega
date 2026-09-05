import { RuntimeSnapshot, FixCandidate, Confidence } from "./runtimeTypes";

export function generateFixCandidates(snapshot: RuntimeSnapshot): FixCandidate[] {
  const candidates: FixCandidate[] = [];
  const exception = snapshot.exception || "";
  const topFrame = snapshot.frames[0];

  if (!topFrame) {
    candidates.push({
      title: "Start debug session",
      description: "No stack frames captured. Launch a debug session and trigger the error.",
      priority: "high",
      category: "error_handling",
      confidence: "low",
    });
    return candidates;
  }

  // Null/undefined variable fix
  const nullVars = topFrame.variables.filter(
    (v) => v.value === "undefined" || v.value === "null" || v.value === ""
  );
  if (nullVars.length > 0) {
    for (const v of nullVars) {
      candidates.push({
        title: `Null check for \`${v.name}\``,
        description: `Add null/undefined guard for \`${v.name}\` before usage in ${topFrame.name}. Current value: ${v.value} (${v.type})`,
        priority: "critical",
        category: "null_check",
        confidence: "high",
        codeSnippet: `if (${v.name} == null) {\n  throw new Error('${v.name} is required');\n}`,
      });

      candidates.push({
        title: `Input validation for \`${v.name}\``,
        description: `Validate \`${v.name}\` at the entry point of ${topFrame.name}`,
        priority: "high",
        category: "validation",
        confidence: "medium",
        codeSnippet: `function validate${v.name.charAt(0).toUpperCase() + v.name.slice(1)}(value: unknown): asserts value is string {\n  if (typeof value !== 'string' || value.length === 0) {\n    throw new Error('${v.name} must be a non-empty string');\n  }\n}`,
      });
    }
  }

  // TypeError without specific variable
  if (exception.includes("TypeError") && nullVars.length === 0) {
    candidates.push({
      title: "Type guard check",
      description: "Add runtime type check for the operation that failed",
      priority: "high",
      category: "type_guard",
      confidence: "medium",
      codeSnippet: `if (typeof value !== 'expected') {\n  throw new TypeError('Unexpected type: ' + typeof value);\n}`,
    });
  }

  // Generic error handling
  if (exception) {
    candidates.push({
      title: "Add error boundary",
      description: `Wrap the operation in ${topFrame.name} with try/catch to handle: ${exception}`,
      priority: "medium",
      category: "error_handling",
      confidence: "medium",
      codeSnippet: `try {\n  // existing operation\n} catch (error) {\n  console.error('${topFrame.name} failed:', error);\n  throw error;\n}`,
    });
  }

  // Always add at least one candidate
  if (candidates.length === 0) {
    candidates.push({
      title: "Review logic",
      description: `Review the logic in ${topFrame.name} at ${topFrame.file}:${topFrame.line}`,
      priority: "low",
      category: "error_handling",
      confidence: "low",
    });
  }

  return candidates;
}
