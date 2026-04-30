function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function adaptForWeb(text: string): string {
  return normalizeWhitespace(text);
}
