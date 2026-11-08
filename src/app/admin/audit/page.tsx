import { prisma } from "@/server/db";

export const metadata = { title: "Admin · Audit log" };

export default async function AdminAuditPage() {
  const rows = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { admin: { select: { email: true } } } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin audit log</h1>
      <p className="text-sm text-muted">Every change made through the admin panel, with before/after snapshots.</p>
      <ul className="card divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted">{r.createdAt.toLocaleString("en-US")}</span><span className="badge border border-border bg-surface-2">{r.action}</span><span>{r.entityType}{r.entityId && <span className="font-mono text-xs text-muted"> {r.entityId}</span>}</span><span className="text-muted">by {r.admin.email}</span></div>
            {(r.before || r.after) && (
              <details className="mt-1 text-xs"><summary className="cursor-pointer text-accent">diff</summary>
                <div className="mt-1 grid gap-2 sm:grid-cols-2"><pre className="overflow-auto rounded bg-bg/60 p-2 font-mono">{JSON.stringify(r.before, null, 1)}</pre><pre className="overflow-auto rounded bg-bg/60 p-2 font-mono">{JSON.stringify(r.after, null, 1)}</pre></div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
