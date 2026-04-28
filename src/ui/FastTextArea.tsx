"use client";

import React, { useEffect, useImperativeHandle, useRef } from "react";
import {
  registerSurface,
  setActiveSurface,
  rememberScroll as saveScroll,
  restoreScroll,
} from "@/ui/activeSurface";

export type FastTextAreaHandle = {
  focus: () => void;
  jumpTop: () => void;
  setText: (v: string) => void;
  getText: () => string;
};

export type FastTextAreaSurface = "textarea" | "code" | "viewer";

type Props = {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  onChangeDebounced?: (v: string) => void;
  debounceMs?: number;
  onScrollStateChange?: (scrollTop: number) => void;
  surfaceId?: string;
  surfaceType?: FastTextAreaSurface;
  rememberScroll?: boolean;
};

export default React.forwardRef<FastTextAreaHandle, Props>(function FastTextArea(
  {
    defaultValue = "",
    placeholder,
    className,
    onChangeDebounced,
    debounceMs = 120,
    onScrollStateChange,
    surfaceId,
    surfaceType = "textarea",
    rememberScroll = false,
  },
  ref
) {
  const elRef = useRef<HTMLTextAreaElement | null>(null);
  const valueRef = useRef<string>(defaultValue);
  const tRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef<number>(0);

  useEffect(() => {
    valueRef.current = defaultValue ?? "";
    if (elRef.current && elRef.current.value !== valueRef.current) {
      elRef.current.value = valueRef.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!surfaceId) return;
    const unregister = registerSurface({
      id: surfaceId,
      type: surfaceType,
      focus: () => elRef.current?.focus(),
      getScrollTop: () => elRef.current?.scrollTop ?? 0,
      setScrollTop: (top: number) => {
        if (elRef.current) elRef.current.scrollTop = top;
      },
    });

    if (rememberScroll) {
      const saved = restoreScroll(surfaceId);
      if (saved !== null && elRef.current) {
        elRef.current.scrollTop = saved;
      }
    }

    return () => {
      if (rememberScroll && elRef.current) {
        saveScroll(surfaceId, elRef.current.scrollTop);
      }
      unregister();
    };
  }, [rememberScroll, surfaceId, surfaceType]);

  useImperativeHandle(ref, () => ({
    focus() {
      elRef.current?.focus();
    },
    jumpTop() {
      const el = elRef.current;
      if (!el) return;
      el.scrollTop = 0;
      requestAnimationFrame(() => {
        el.scrollTop = 0;
      });
      onScrollStateChange?.(0);
    },
    setText(v: string) {
      valueRef.current = v ?? "";
      if (elRef.current) elRef.current.value = valueRef.current;
    },
    getText() {
      return elRef.current?.value ?? valueRef.current ?? "";
    },
  }));

  function flushDebounced(v: string) {
    if (!onChangeDebounced) return;
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => onChangeDebounced(v), debounceMs) as any;
  }

  function emitScrollTop(scrollTop: number) {
    if (!onScrollStateChange) return;
    if (Math.abs(scrollTop - lastScrollTopRef.current) < 2) return;
    lastScrollTopRef.current = scrollTop;
    onScrollStateChange(scrollTop);
  }

  function onScroll() {
    const el = elRef.current;
    if (!el) return;
    if (surfaceId && document.activeElement === el) {
      const src = `FastTextArea:${surfaceId}`;
      setActiveSurface(surfaceId, "scroll", src);
    }
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      emitScrollTop(el.scrollTop);
    });
  }

  return (
    <textarea
      ref={elRef}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={className}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      onChange={(e) => {
        const v = e.currentTarget.value;
        valueRef.current = v;
        flushDebounced(v);
      }}
      onScroll={onScroll}
      onPointerDown={() => {
        // ASC CANON: do not call setActiveSurface twice for the same event.
        // Always pass (reason, sourceId) once to preserve trace truth.
        if (surfaceId) {
          const src = `FastTextArea:${surfaceId}`;
          setActiveSurface(surfaceId, "pointer", src);
        }
      }}
      onFocus={() => {
        if (surfaceId) {
          const src = `FastTextArea:${surfaceId}`;
          setActiveSurface(surfaceId, "focus", src);
        }
      }}
      style={{ WebkitOverflowScrolling: "touch" as any }}
    />
  );
});
