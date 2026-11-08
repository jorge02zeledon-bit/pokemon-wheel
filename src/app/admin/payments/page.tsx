import Link from "next/link";
import { prisma } from "@/server/db";
import { config } from "@/server/config";
import { formatCents } from "@/lib/money";
import { WithdrawalActions } from "@/components/admin/WithdrawalActions";

export const metadata = { title: "Admin · Payments" };

export default async function AdminPaymentsPage() {
  const [deposits, withdrawals] = await Promise.all([
    prisma.deposit.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { id: true, email: true } } } }),
    prisma.withdrawal.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { id: true, email: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payments</h1>
      <p className="text-sm text-muted">
        Provider: <span className="font-mono">{config.paymentProvider}</span>. {config.realMoneyEnabled ? "" : "Real money is disabled; no new deposits or withdrawals can be created."}
      </p>
      <section className="card overflow-x-auto">
        <h2 className="p-4 text-lg font-bold">Withdrawals</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Created</th><th className="p-3">User</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th><th className="p-3">Destination</th><th className="p-3"></th></tr></thead>
          <tbody className="divide-y divide-border">
            {withdrawals.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">None.</td></tr>}
            {withdrawals.map((w) => (
              <tr key={w.id}>
                <td className="p-3 text-muted">{w.createdAt.toLocaleString("en-US")}</td>
                <td className="p-3"><Link href={`/admin/users/${w.user.id}`} className="hover:text-accent">{w.user.email}</Link></td>
                <td className="p-3 text-right font-mono">{formatCents(w.amountCents)}</td>
                <td className="p-3"><span className="badge border border-border bg-surface-2">{w.status}</span></td>
                <td className="p-3 font-mono text-xs text-muted">{JSON.stringify(w.metadata)}</td>
                <td className="p-3">{w.status === "PENDING" && <WithdrawalActions id={w.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="p-4 text-lg font-bold">Deposits</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Created</th><th className="p-3">User</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th><th className="p-3">Provider ref</th></tr></thead>
          <tbody className="divide-y divide-border">
            {deposits.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted">None.</td></tr>}
            {deposits.map((d) => (
              <tr key={d.id}>
                <td className="p-3 text-muted">{d.createdAt.toLocaleString("en-US")}</td>
                <td className="p-3"><Link href={`/admin/users/${d.user.id}`} className="hover:text-accent">{d.user.email}</Link></td>
                <td className="p-3 text-right font-mono">{formatCents(d.amountCents)}</td>
                <td className="p-3"><span className="badge border border-border bg-surface-2">{d.status}</span></td>
                <td className="p-3 font-mono text-xs text-muted">{d.providerRef}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
