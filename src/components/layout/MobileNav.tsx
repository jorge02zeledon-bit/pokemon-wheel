"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item { href: string; label: string }

/** Hamburger navigation for small screens. Closes on route change and Escape. */
export function MobileNav({ items, signOut }: { items: Item[]; signOut?: () => Promise<void> }) {
  const pathname = usePathname();
  // The menu is "open for" one pathname; navigating anywhere else closes it
  // without needing an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenFor((prev) => ((typeof v === "function" ? v(prev === pathname) : v) ? pathname : null));
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenFor(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="sm:hidden">
      <button
        type="button"
        className="btn-ghost px-2"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id={id} aria-label="Main" className="absolute inset-x-0 top-full border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
          <ul className="space-y-1">
            {items.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className={`block rounded-lg px-3 py-2 ${pathname === n.href ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          {signOut && (
            <form action={signOut} className="mt-2 border-t border-border pt-2">
              <button type="submit" className="btn-ghost w-full justify-start px-3">Sign out</button>
            </form>
          )}
        </nav>
      )}
    </div>
  );
}
