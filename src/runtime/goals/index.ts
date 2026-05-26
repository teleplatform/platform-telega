// TODO(RD-2): implement goals module
export function loadGoals(): void {}
export function recoverGoals(): { recovered: number; abandoned: number; details: string[] } { return { recovered: 0, abandoned: 0, details: [] }; }
export function getAbandonedAlert(): string | undefined { return undefined; }
export function getGoalInventory(): string { return "No goals in inventory."; }
export function getWhatMatters(): string { return ""; }
export function getUnfinishedBusiness(): string { return ""; }