import { OverrideRequest, OverrideAction, OverrideTargetType, OverrideStatus } from "./overrideTypes";

const overrides: OverrideRequest[] = [];

let counter = 0;
function genId(): string {
  counter++;
  return `ovr_${Date.now()}_${counter}`;
}

export const OverrideRegistry = {
  create(
    targetType: OverrideTargetType,
    targetId: string,
    action: OverrideAction,
    reason: string,
    requestedBy: string
  ): OverrideRequest {
    const request: OverrideRequest = {
      overrideId: genId(),
      targetType,
      targetId,
      action,
      reason,
      requestedBy,
      status: "pending",
      result: null,
      createdAt: Date.now(),
      executedAt: null,
    };
    overrides.push(request);
    return request;
  },

  get(id: string): OverrideRequest | undefined {
    return overrides.find((o) => o.overrideId === id);
  },

  getAll(): OverrideRequest[] {
    return [...overrides];
  },

  getByTarget(targetId: string): OverrideRequest[] {
    return overrides.filter((o) => o.targetId === targetId);
  },

  getPending(): OverrideRequest[] {
    return overrides.filter((o) => o.status === "pending");
  },

  updateStatus(id: string, status: OverrideStatus, result?: string): OverrideRequest | null {
    const req = overrides.find((o) => o.overrideId === id);
    if (!req) return null;
    req.status = status;
    if (status === "executed") req.executedAt = Date.now();
    if (result) req.result = result;
    return req;
  },

  size(): number {
    return overrides.length;
  },
};
