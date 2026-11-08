"use client";

import { useSyncExternalStore } from "react";

const KEY = "hw.ageConfirmed";
const EVENT = "hw:age-confirmed";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}
function readConfirmed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // storage blocked: do not trap the user behind a gate that cannot be dismissed
  }
}

/**
 * First-visit 18+ interstitial. Remembered per browser; signup separately
 * records a binding confirmation on the account. Rendered as "confirmed" on
 * the server (so it never flashes for crawlers or SSR) and read from storage
 * on the client.
 */
export function AgeGate() {
  const confirmed = useSyncExternalStore(subscribe, readConfirmed, () => true);
  if (confirmed) return null;
  const accept = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/90 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="age-title" className="card max-w-md space-y-4 p-6 text-center">
        <h2 id="age-title" className="text-2xl font-black">Are you 18 or older?</h2>
        <p className="text-sm text-muted">HonshuWheel offers chance-based prize wheels for adults only. You must be at least 18 and located where this service is permitted.</p>
        <div className="grid grid-cols-2 gap-2">
          <a href="https://www.ncpgambling.org/" className="btn-secondary">No, take me away</a>
          <button type="button" className="btn-primary" onClick={accept} autoFocus>Yes, I am 18+</button>
        </div>
        <p className="text-xs text-muted">Play responsibly. Help: 1-800-GAMBLER.</p>
      </div>
    </div>
  );
}
