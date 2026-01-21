// src/server/llm/extract.ts
export function extractTaggedText(raw: string, tag = "t"): string {
  const s = String(raw || "").trim();
  const open = `<${tag}>`;
  const close = `</${tag}>`;

  let result: string;
  if (s.includes(open)) {
    const afterOpen = s.split(open).slice(1).join(open);
    result = afterOpen.includes(close) ? afterOpen.split(close)[0] : afterOpen;
  } else {
    result = s;
  }

  // чистим "TEXT:" и вложенные <t> теги
  return result
    .replace(/^TEXT:\s*/i, "")
    .replace(/^\s*<t>\s*/i, "")
    .replace(/\s*<\/t>\s*$/i, "")
    .trim();
}
