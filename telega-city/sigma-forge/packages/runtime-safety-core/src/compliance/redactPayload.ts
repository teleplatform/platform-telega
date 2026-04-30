import type { RedactionEntry } from "../../runtime-safety-contracts/src/compliance.js";

function applyRedactionsToText(text: string, redactions: RedactionEntry[]): string {
  let result = text;
  const sorted = [...redactions].filter((r) => r.start !== undefined && r.end !== undefined).sort((a, b) => (b.start ?? 0) - (a.start ?? 0));
  for (const r of sorted) {
    if (r.start !== undefined && r.end !== undefined) {
      result = result.substring(0, r.start) + r.replacement + result.substring(r.end);
    }
  }
  return result;
}

export function redactText(text: string, redactions: RedactionEntry[]): string {
  return applyRedactionsToText(text, redactions);
}

export function redactObject(obj: Record<string, unknown>, redactions: RedactionEntry[]): Record<string, unknown> {
  const result = { ...obj };
  const fieldRedactions = redactions.filter((r) => r.field);

  for (const r of fieldRedactions) {
    if (r.field && result[r.field] !== undefined) {
      if (typeof result[r.field] === "string" && r.start !== undefined) {
        result[r.field] = redactText(result[r.field] as string, [r]);
      } else {
        result[r.field] = r.replacement;
      }
    }
  }

  return result;
}
