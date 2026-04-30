export interface ParsedContent {
  type: 'answer' | 't' | 'json' | 'raw';
  content: string;
  valid: boolean;
}

export function parseContent(text: string, expectedTag: 'answer' | 't' | 'json' = 'answer'): ParsedContent {
  const openTag = `<${expectedTag}>`;
  const closeTag = `</${expectedTag}>`;

  const startIndex = text.indexOf(openTag);
  
  if (startIndex === -1) {
    // Tag not found
    return { type: 'raw', content: text, valid: false };
  }

  const contentStart = startIndex + openTag.length;
  const endIndex = text.indexOf(closeTag, contentStart);
  
  const extracted = endIndex !== -1 
    ? text.substring(contentStart, endIndex) 
    : text.substring(contentStart); // Streaming or incomplete

  return { type: expectedTag, content: extracted, valid: true };
}
