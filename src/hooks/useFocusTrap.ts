"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside a dialog while it is open, focuses the first
 * control on mount, restores focus to the opener on unmount, and closes on
 * Escape. Attach the returned ref to the dialog container.
 */
export function useFocusTrap<T extends HTMLElement>(onClose?: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables()[0] ?? node).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);
  return ref;
}
