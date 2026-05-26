// TODO(RD-2): implement executor router
export function getExecutorRouter(): { resolveExecutor: (_: unknown) => { target: string } } | null {
  return null;
}
export function initExecutorRouter(): void {}
export type ForgeTask = {
  taskId: string;
  target?: string;
  kind: string;
  userId?: string;
  path?: string;
  input?: Record<string, unknown>;
};