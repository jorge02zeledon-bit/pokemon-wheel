import Link from "next/link";
import { Rarity } from "@prisma/client";
import { prisma } from "@/server/db";
import { listSpinsForAdmin } from "@/server/admin/spins";
import { formatCents } from "@/lib/money";
import { TierBadge } from "@/components/wheel/TierBadge";

export const metadata = { title: "Admin · Spin audit log" };

export default async function AdminSpinsPage({ searchParams }: PageProps<"/admin/spins">) {
  const sp = await searchParams;
  const f = {
    wheelId: typeof sp.wheelId === "string" && sp.wheelId ? sp.wheelId : undefined,
    email: typeof sp.email === "string" && sp.email ? sp.email : undefined,
    rarity: typeof sp.rarity === "string" && (Object.values(Rarity) as string[]).includes(sp.rarity) ? (sp.rarity as Rarity) : undefined,
    page: Number(sp.page) || 1,
  };
  const [wheels, result] = await Promise.all([prisma.wheel.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }), listSpinsForAdmin(f)]);
  const qs = (page: number) => `?${new URLSearchParams({ ...(f.wheelId ? { wheelId: f.wheelId } : {}), ...(f.email ? { email: f.email } : {}), ...(f.rarity ? { rarity: f.rarity } : {}), page: String(page) })}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Spin audit log</h1>
        <a href={`/api/admin/spins.csv${qs(1)}`} className="btn-secondary px-3 py-1.5 text-xs">Export CSV (first 200)</a>
      </div>
      <p className="text-xs text-muted">Append-only: the database rejects any update or delete on this table. {result.total.toLocaleString()} spins match.</p>
      <form className="card grid gap-2 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]" action="/admin/spins">
        <select name="wheelId" defaultValue={f.wheelId ?? ""} className="input" aria-label="Wheel"><option value="">All wheels</option>{wheels.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <select name="rarity" defaultValue={f.rarity ?? ""} className="input" aria-label="Rarity"><option value="">All tiers</option>{Object.values(Rarity).map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <input name="email" defaultValue={f.email ?? ""} className="input" placeholder="User email contains…" aria-label="Email" />
        <button className="btn-secondary" type="submit">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">When</th><th className="p-3">User</th><th className="p-3">Wheel</th><th className="p-3">Result</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">Value</th><th className="p-3">Nonce</th><th className="p-3">Fairness</th></tr></thead>
          <tbody className="divide-y divide-border">
            {result.rows.map((s) => (
              <tr key={s.id}>
                <td className="p-3 text-muted">{s.createdAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "medium" })}{s.isDemo && <span className="ml-1 text-xs text-warning">demo</span>}</td>
                <td className="p-3"><Link href={`/admin/users/${s.user.id}`} className="hover:text-accent">{s.user.email}</Link>{s.ipState && <span className="ml-1 font-mono text-xs text-muted">({s.ipState})</span>}</td>
                <td className="p-3">{s.wheel.name}</td>
                <td className="p-3"><TierBadge rarity={s.tier.rarity} name={s.tier.name} /> <span className="ml-1">{s.product.name}</span></td>
                <td className="p-3 text-right font-mono">{formatCents(s.spinPriceCents, { compact: true })}</td>
                <td className="p-3 text-right font-mono">{formatCents(s.productValueCents, { compact: true })}</td>
                <td className="p-3 font-mono">{s.nonce}</td>
                <td className="p-3">
                  <details className="text-xs"><summary className="cursor-pointer text-accent">seeds</summary>
                    <dl className="mt-1 space-y-0.5 font-mono"><dt className="text-muted">server seed</dt><dd className="break-all">{s.serverSeed}</dd><dt className="text-muted">hash</dt><dd className="break-all">{s.serverSeedHash}</dd><dt className="text-muted">client seed</dt><dd className="break-all">{s.clientSeed}</dd><dt className="text-muted">result</dt><dd className="break-all">{s.resultHash}</dd><dt className="text-muted">rolls</dt><dd>{s.tierRoll} / {s.productRoll}</dd></dl>
                    <Link href={`/fair?spin=${s.id}`} className="mt-1 inline-block text-accent">open verifier</Link>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="flex items-center justify-between text-sm">
        <span className="text-muted">Page {result.page} of {result.pages}</span>
        <span className="flex gap-2">
          {result.page > 1 && <Link href={qs(result.page - 1)} className="btn-secondary px-3 py-1.5 text-xs">← Newer</Link>}
          {result.page < result.pages && <Link href={qs(result.page + 1)} className="btn-secondary px-3 py-1.5 text-xs">Older →</Link>}
        </span>
      </nav>
    </div>
  );
}
