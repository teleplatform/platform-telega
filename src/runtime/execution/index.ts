// TODO(RD-2): implement execution module
export function loadTasks(): void {}
export function recoverTasks(): { recovered: number; failed: number; details: string[] } { return { recovered: 0, failed: 0, details: [] }; }
export function taskSummary(): string { return "No tasks."; }
export function getInterruptedTasks(): string[] { return []; }