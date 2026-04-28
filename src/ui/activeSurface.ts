"use client";

export type SurfaceType = "textarea" | "code" | "viewer";
export type ActivateReason = "pointer" | "focus" | "scroll" | "programmatic";

type Surface = {
  id: string;
  type: SurfaceType;
  focus?: () => void;
  getScrollTop?: () => number;
  setScrollTop?: (top: number) => void;
};

const surfaces = new Map<string, Surface>();
let activeId: string | null = null;

type SurfaceSwitchEvent = {
  seq: number;
  t: number;
  id: string;
  type: SurfaceType;
  reason: ActivateReason;
  sourceId?: string;
};

const SWITCH_LIMIT = 10;
const switchRing: SurfaceSwitchEvent[] = [];
let switchSeq = 0;
const FRAME_MS = 16;
let lastGuard: { frame: number; id: string; reason: ActivateReason; sourceId?: string } | null = null;

function getFrame() {
  const now =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  return Math.floor(now / FRAME_MS);
}

function devGuard(id: string, reason: ActivateReason, sourceId?: string) {
  if (process.env.NODE_ENV === "production") return;
  if (!isMakerEnabled()) return;
  const frame = getFrame();
  if (lastGuard && lastGuard.frame === frame && lastGuard.id === id) {
    const changed = lastGuard.reason !== reason || lastGuard.sourceId !== sourceId;
    if (changed) {
      console.warn("[ASC] Duplicate activation in same frame", {
        id,
        prev: lastGuard,
        next: { frame, id, reason, sourceId },
      });
    }
  }
  lastGuard = { frame, id, reason, sourceId };
}

function isMakerEnabled() {
  try {
    return localStorage.getItem("telegpt_maker") === "1";
  } catch {
    return false;
  }
}

function pushSwitch(e: SurfaceSwitchEvent) {
  switchRing.unshift(e);
  if (switchRing.length > SWITCH_LIMIT) switchRing.pop();
}

export function getSurfaceSwitches() {
  return switchRing.slice();
}

export function registerSurface(surface: Surface) {
  surfaces.set(surface.id, surface);
  return () => surfaces.delete(surface.id);
}

export function setActiveSurface(
  id: string,
  reason: ActivateReason = "programmatic",
  sourceId?: string
) {
  if (!surfaces.has(id)) return;
  devGuard(id, reason, sourceId);
  if (activeId === id) return;
  activeId = id;
  const s = surfaces.get(id);
  pushSwitch({
    seq: ++switchSeq,
    t: Date.now(),
    id,
    type: s?.type ?? "textarea",
    reason,
    sourceId,
  });
}

export function getActiveSurfaceId() {
  return activeId;
}

export function getActiveSurfaceSnapshot() {
  if (!activeId) return null;
  const s = surfaces.get(activeId);
  if (!s) return null;
  const top = s.getScrollTop ? s.getScrollTop() : null;
  return {
    id: s.id,
    type: s.type,
    scrollTop: top,
    registeredCount: surfaces.size,
  };
}

export function getSurfaceSnapshotById(id: string) {
  const s = surfaces.get(id);
  if (!s) return null;
  return {
    id: s.id,
    type: s.type,
    scrollTop: s.getScrollTop ? s.getScrollTop() : null,
  };
}

export function jumpTopActive(opts?: { preferId?: string; sourceId?: string }) {
  const id = opts?.preferId && surfaces.has(opts.preferId) ? opts.preferId : activeId;
  if (!id) return;
  const surface = surfaces.get(id);
  if (!surface) return;

  setActiveSurface(id, "programmatic", opts?.sourceId ?? "jumpTopActive");

  const get = surface.getScrollTop;
  const set = surface.setScrollTop;
  if (!get || !set) {
    surface.focus?.();
    return;
  }

  const start = get();
  if (start <= 0) return;

  const duration = 140;
  const t0 = performance.now();

  function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
  }

  function tick(now: number) {
    const elapsed = now - t0;
    const p = Math.min(1, elapsed / duration);
    const eased = easeOutCubic(p);
    set(Math.round(start * (1 - eased)));
    if (p < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

export function rememberScroll(surfaceId: string, scrollTop: number) {
  try {
    sessionStorage.setItem(`telegpt_scroll_${surfaceId}`, String(scrollTop));
  } catch {
    // ignore
  }
}

export function restoreScroll(surfaceId: string) {
  try {
    const v = sessionStorage.getItem(`telegpt_scroll_${surfaceId}`);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
