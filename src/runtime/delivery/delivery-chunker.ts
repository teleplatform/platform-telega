import type { OutputChunk, ChunkingOptions } from "./output-relay.types.js";
import { DEFAULT_CHUNKING_OPTIONS } from "./output-relay.types.js";

export class DeliveryChunker {
  private options: ChunkingOptions;

  constructor(options?: Partial<ChunkingOptions>) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  chunk(relayId: string, text: string): OutputChunk[] {
    if (!text) return [];
    const raw = this.options.preserve_code_fences ? text : text;
    const parts = this.splitText(raw);
    return parts.map((part, i) => ({
      chunk_id: `${relayId}_chunk_${i}`,
      relay_id: relayId,
      index: i,
      total: parts.length,
      text: this.options.add_part_headers && parts.length > 1 ? `Часть ${i + 1}/${parts.length}\n\n${part}` : part,
      chars: part.length,
      kind: this.detectKind(part),
      delivered: false,
    }));
  }

  private splitText(text: string): string[] {
    const max = this.options.max_chars;
    if (text.length <= max) return [text];

    const parts: string[] = [];

    const codeBlocks = this.extractCodeBlocks(text);
    if (codeBlocks.length > 0) {
      for (const block of codeBlocks) {
        if (block.length <= max) {
          parts.push(block);
        } else {
          parts.push(...this.splitByParagraphs(block, max));
        }
      }
      return parts;
    }

    const fenceSplit = this.splitByFences(text);
    for (const segment of fenceSplit) {
      if (segment.length <= max) {
        parts.push(segment);
      } else {
        parts.push(...this.splitByParagraphs(segment, max));
      }
    }

    return parts.length > 0 ? parts : this.splitByParagraphs(text, max);
  }

  private splitByFences(text: string): string[] {
    const parts: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      const fenceIdx = remaining.indexOf("```");
      if (fenceIdx === -1) {
        parts.push(remaining);
        break;
      }

      if (fenceIdx > 0) {
        parts.push(remaining.slice(0, fenceIdx));
      }

      const closeIdx = remaining.indexOf("```", fenceIdx + 3);
      if (closeIdx === -1) {
        parts.push(remaining.slice(fenceIdx));
        break;
      }

      parts.push(remaining.slice(fenceIdx, closeIdx + 3));
      remaining = remaining.slice(closeIdx + 3);
    }

    return parts.filter(Boolean);
  }

  private splitByParagraphs(text: string, maxChars: number): string[] {
    const parts: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let current = "";

    for (const para of paragraphs) {
      if ((current + "\n\n" + para).trim().length <= maxChars) {
        current = current ? current + "\n\n" + para : para;
      } else {
        if (current) parts.push(current);
        if (para.length > maxChars) {
          parts.push(...this.splitBySentences(para, maxChars));
          current = "";
        } else {
          current = para;
        }
      }
    }
    if (current) parts.push(current);

    return parts.length > 0 ? parts : this.splitBySentences(text, maxChars);
  }

  private splitBySentences(text: string, maxChars: number): string[] {
    const parts: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
    let current = "";

    for (const sent of sentences) {
      if ((current + sent).length <= maxChars) {
        current += sent;
      } else {
        if (current) parts.push(current);
        if (sent.length > maxChars) {
          for (let i = 0; i < sent.length; i += maxChars) {
            parts.push(sent.slice(i, i + maxChars));
          }
        } else {
          current = sent;
        }
      }
    }
    if (current) parts.push(current);

    return parts;
  }

  private extractCodeBlocks(text: string): string[] {
    const blocks: string[] = [];
    const regex = /```[\s\S]*?```/g;
    let lastEnd = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastEnd) {
        const before = text.slice(lastEnd, match.index).trim();
        if (before) blocks.push(before);
      }
      blocks.push(match[0]);
      lastEnd = match.index + match[0].length;
    }
    if (lastEnd < text.length) {
      const after = text.slice(lastEnd).trim();
      if (after) blocks.push(after);
    }

    return blocks;
  }

  private detectKind(text: string): "text" | "markdown" | "code" {
    if (text.startsWith("```") && text.endsWith("```")) return "code";
    if (/[*_#\[\]()`>|-]/.test(text)) return "markdown";
    return "text";
  }
}
