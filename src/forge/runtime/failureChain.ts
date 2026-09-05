import { RuntimeSnapshot, FailureChain, FailureLink, RootCauseResult } from "./runtimeTypes";

export function buildFailureChain(
  snapshot: RuntimeSnapshot,
  rootCause: RootCauseResult
): FailureChain {
  const links: FailureLink[] = [];
  const frames = snapshot.frames;

  for (let i = 0; i < frames.length - 1; i++) {
    const current = frames[i];
    const next = frames[i + 1];
    links.push({
      from: current.name,
      fromFile: current.file,
      fromLine: current.line,
      to: next.name,
      toFile: next.file,
      toLine: next.line,
      reason: i === 0 ? "exception thrown" : "call chain",
    });
  }

  return {
    links,
    root: rootCause,
    depth: frames.length,
  };
}
