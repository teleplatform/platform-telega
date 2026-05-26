// TODO(RD-2): implement identity module
export function initializeFacts(): void {}
export function evaluateMessage(_msg: string): { shouldBlock: boolean; replyText?: string; systemPromptOverride?: string } { return { shouldBlock: false }; }
export function getFullSystemPrompt(): string { return ""; }