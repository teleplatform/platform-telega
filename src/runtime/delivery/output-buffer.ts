export class OutputBuffer {
  private buffers = new Map<string, { text: string; completed: boolean }>();

  append(relayId: string, text: string): void {
    const entry = this.buffers.get(relayId) ?? { text: "", completed: false };
    entry.text = text;
    this.buffers.set(relayId, entry);
  }

  appendTail(relayId: string, tail: string): void {
    const entry = this.buffers.get(relayId) ?? { text: "", completed: false };
    entry.text += tail;
    this.buffers.set(relayId, entry);
  }

  getFullText(relayId: string): string {
    return this.buffers.get(relayId)?.text ?? "";
  }

  getCharCount(relayId: string): number {
    return this.getFullText(relayId).length;
  }

  getNewTextSince(relayId: string, charOffset: number): string {
    const full = this.getFullText(relayId);
    if (charOffset >= full.length) return "";
    return full.slice(charOffset);
  }

  markComplete(relayId: string): void {
    const entry = this.buffers.get(relayId);
    if (entry) entry.completed = true;
  }

  isComplete(relayId: string): boolean {
    return this.buffers.get(relayId)?.completed ?? false;
  }

  has(relayId: string): boolean {
    return this.buffers.has(relayId);
  }

  remove(relayId: string): void {
    this.buffers.delete(relayId);
  }

  getAllIds(): string[] {
    return [...this.buffers.keys()];
  }

  clear(): void {
    this.buffers.clear();
  }
}
