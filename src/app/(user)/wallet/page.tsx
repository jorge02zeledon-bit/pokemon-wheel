import { requireUserOrRedirect } from "@/server/guards";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/config";
import { getDemoRefillStatus } from "@/server/wallet/demo";
import { formatCents } from "@/lib/money";
import { RefillButton } from "@/components/wallet/RefillButton";
import { Alert } from "@/components/ui/Alert";

export const metadata = { title: "Wallet" };

const TYPE_LABELS: Record<string, string> = {
  DEMO_GRANT: "Demo credits",
  SPIN: "Spin",
  BUYBACK: "Buyback",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  SHIPPING_FEE: "Shipping fee",
  ADJUSTMENT: "Adjustment",
  REFUND: "Refund",
};

export default async function WalletPage() {
  const user = await requireUserOrRedirect();
  const demo = isDemoMode();
  const [entries, refill] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { userId: user.id, isDemo: demo }, orderBy: { createdAt: "desc" }, take: 50 }),
    demo ? getDemoRefillStatus(user.id) : null,
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-black">Wallet</h1>

      <section className="card grid gap-6 p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{demo ? "Demo balance" : "Balance"}</p>
          <p className="mt-1 font-mono text-4xl font-black">{formatCents(demo ? user.demoBalanceCents : user.realBalanceCents)}</p>
          {demo && <p className="mt-2 text-xs text-muted">Demo credits have no cash value and never convert to real money.</p>}
        </div>
        <div className="space-y-3">
          {demo && refill ? (
            <RefillButton status={{ ...refill, availableAt: refill.availableAt?.toISOString() ?? null }} />
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled title={demo ? "Disabled in demo mode" : undefined}>Deposit</button>
            <button type="button" className="btn-secondary" disabled title={demo ? "Disabled in demo mode" : undefined}>Withdraw</button>
          </div>
          {demo && <Alert kind="warning">Deposits and withdrawals are disabled while the site is in demo mode.</Alert>}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold">Transaction history</h2>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No transactions yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="py-2">Date</th><th className="py-2">Type</th><th className="py-2">Description</th><th className="py-2 text-right">Amount</th><th className="py-2 text-right">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 text-muted">{e.createdAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="py-2">{TYPE_LABELS[e.type] ?? e.type}</td>
                  <td className="py-2 text-muted">{e.description}</td>
                  <td className={`py-2 text-right font-mono ${e.amountCents < 0 ? "text-danger" : "text-success"}`}>{e.amountCents > 0 ? "+" : ""}{formatCents(e.amountCents)}</td>
                  <td className="py-2 text-right font-mono text-muted">{formatCents(e.balanceAfterCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
