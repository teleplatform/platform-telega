export type ToastKind = "success" | "error" | "info";

export type ToastPayload = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  iconSrc?: string;
  durationMs?: number;
};

type Listener = (t: ToastPayload | null) => void;

let current: ToastPayload | null = null;
const listeners = new Set<Listener>();

export const toast = {
  show(payload: Omit<ToastPayload, "id">) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    current = { id, durationMs: 1800, ...payload };
    for (const l of listeners) l(current);
    if (current.durationMs && current.durationMs > 0) {
      const myId = id;
      globalThis.setTimeout(() => {
        if (current?.id === myId) toast.clear();
      }, current.durationMs);
    }
  },
  clear() {
    current = null;
    for (const l of listeners) l(current);
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    fn(current);
    return () => listeners.delete(fn);
  },
};
