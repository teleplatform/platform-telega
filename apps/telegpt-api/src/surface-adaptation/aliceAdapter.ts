function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function smoothForSpoken(sentence: string): string {
  const smoothed = sentence
    .replace(/\b(во-первых|во-вторых|в-третьих)\b/giu, "")
    .replace(/\b(как правило|как известно|как обычно)\b/giu, "")
    .replace(/\s+/g, " ")
    .trim();

  return smoothed;
}

export function adaptForAlice(text: string): string {
  const normalized = normalizeWhitespace(text);
  const sentences = splitSentences(normalized);

  const adapted = sentences.map(smoothForSpoken).filter(Boolean);
  const joined = adapted.join(" ").trim();

  return /[.!?…]$/.test(joined) ? joined : `${joined}.`;
}
