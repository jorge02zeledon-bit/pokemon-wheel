import { notFound } from "next/navigation";
import Link from "next/link";
import { getUserForAdmin } from "@/server/admin/users";
import { requireAdminOrRedirect } from "@/server/guards";
import { UserActions } from "@/components/admin/UserActions";
import { IdentityOverride } from "@/components/admin/IdentityOverride";
import { formatCents } from "@/lib/money";
import { stateName } from "@/lib/us-states";

export const metadata = { title: "Admin · User" };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdminOrRedirect();
  const { id } = await params;
  const u = await getUserForAdmin(id);
  if (!u) notFound();
  const activeExclusion = u.selfExclusions.find((e) => !e.endsAt || e.endsAt > new Date());
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{u.displayName ?? u.email}</h1>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <dl className="card grid grid-cols-2 gap-3 p-5 text-sm">
            <div><dt className="text-muted">Email</dt><dd>{u.email}</dd></div>
            <div><dt className="text-muted">Joined</dt><dd>{u.createdAt.toLocaleString("en-US")}</dd></div>
            <div><dt className="text-muted">State</dt><dd>{u.stateCode ? stateName(u.stateCode) : "—"}</dd></div>
            <div><dt className="text-muted">Age confirmed</dt><dd>{u.ageConfirmedAt ? "Yes" : "No"}</dd></div>
            <div><dt className="text-muted">Identity</dt><dd>{u.identityStatus}</dd></div>
            <div><dt className="text-muted">Cooldown</dt><dd>{u.cooldownUntil && u.cooldownUntil > new Date() ? `until ${u.cooldownUntil.toLocaleString("en-US")}` : "none"}</dd></div>
            <div><dt className="text-muted">Demo balance</dt><dd className="font-mono">{formatCents(u.demoBalanceCents)}</dd></div>
            <div><dt className="text-muted">Real balance</dt><dd className="font-mono">{formatCents(u.realBalanceCents)}</dd></div>
            <div><dt className="text-muted">Activity</dt><dd>{u._count.spins} spins · {u._count.vaultItems} items · {u._count.orders} orders</dd></div>
            <div><dt className="text-muted">Self-exclusion</dt><dd className={activeExclusion ? "text-danger" : ""}>{activeExclusion ? `${activeExclusion.duration} since ${activeExclusion.startsAt.toLocaleDateString("en-US")}` : "none"}</dd></div>
            <div className="col-span-2"><dt className="text-muted">Limits</dt><dd className="font-mono text-xs">{u.playLimit ? JSON.stringify({ daily: u.playLimit.dailyDepositCents, weekly: u.playLimit.weeklyDepositCents, monthly: u.playLimit.monthlyDepositCents, dailySpend: u.playLimit.dailySpendCents }) : "none set"}</dd></div>
          </dl>
          <UserActions userId={u.id} role={u.role} isSelf={u.id === admin.id} />
          <div className="card space-y-3 p-5 text-sm">
            <h3 className="text-lg font-bold">Identity</h3>
            <IdentityOverride userId={u.id} status={u.identityStatus} />
            {u.verifications.length > 0 && (
              <ul className="text-xs text-muted">
                {u.verifications.map((v) => <li key={v.id}>{v.createdAt.toLocaleString("en-US")} · {v.provider} · {v.status}{v.reason ? ` · ${v.reason}` : ""}</li>)}
              </ul>
            )}
          </div>
        </div>
        <div className="card p-5 text-sm">
          <h3 className="text-lg font-bold">Recent ledger</h3>
          <table className="mt-3 w-full">
            <tbody className="divide-y divide-border">
              {u.ledgerEntries.map((e) => (
                <tr key={e.id}><td className="py-1.5 text-muted">{e.createdAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</td><td className="py-1.5">{e.type}{e.isDemo ? " (demo)" : ""}</td><td className="py-1.5 text-muted">{e.description}</td><td className={`py-1.5 text-right font-mono ${e.amountCents < 0 ? "text-danger" : "text-success"}`}>{formatCents(e.amountCents)}</td></tr>
              ))}
            </tbody>
          </table>
          <Link href={`/admin/spins?email=${encodeURIComponent(u.email)}`} className="mt-3 inline-block text-xs text-accent">View this user&apos;s spins →</Link>
        </div>
      </div>
    </div>
  );
}
