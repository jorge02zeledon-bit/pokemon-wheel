"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Route error boundary. Never shows internals; logs to the console for the client, server logs have the rest. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-3xl font-black">Something went wrong</h1>
      <p className="text-muted">The page could not be shown. No spin or payment is ever lost: every action is recorded before it is displayed.</p>
      {error.digest && <p className="font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <div className="flex justify-center gap-2">
        <button type="button" className="btn-primary" onClick={reset}>Try again</button>
        <Link href="/" className="btn-secondary">Home</Link>
      </div>
    </div>
  );
}
