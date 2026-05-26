// TODO(RD-2): implement execution stream store
import type { BuildTaskStreamEvent } from "../../types/telecore.js";
export function getExecutionStreamStore(): Map<string, BuildTaskStreamEvent[]> { return new Map(); }