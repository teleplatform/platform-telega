export type ForgeControlAction =
  | { type: "retry"; invocationId: string }
  | { type: "rerun"; invocationId: string }
  | { type: "cancel"; invocationId: string }
  | { type: "mark_reviewed"; invocationId: string }
  | { type: "attach_note"; invocationId: string; note: string };

export type ForgeControlResult = {
  ok: boolean;
  action: string;
  summary: string;
  newInvocationId?: string;
  error?: string;
};

export type ForgeControlEvent = {
  type: "retry" | "rerun" | "cancel" | "review" | "note";
  originalInvocationId: string;
  newInvocationId?: string;
  userId: string;
  role: string;
  timestamp: string;
  note?: string;
};
