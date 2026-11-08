/** Admin loading skeleton. Kept out of the root so public 404s keep a real 404 status. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card h-56 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
