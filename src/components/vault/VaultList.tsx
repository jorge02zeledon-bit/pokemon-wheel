"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { VaultItemView } from "@/server/vault/queries";
import { formatCents } from "@/lib/money";
import { US_STATES } from "@/lib/us-states";
import { TierBadge } from "@/components/wheel/TierBadge";
import { Alert } from "@/components/ui/Alert";
import { Countdown } from "./Countdown";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface Props {
  items: VaultItemView[];
  isDemo: boolean;
  buybackPercent: number;
  shippingFeeCents: number;
  defaultAction: "AUTO_SELL" | "AUTO_SHIP_HOLD";
  windowDays: number;
}

type Dialog = { kind: "sell"; item: VaultItemView } | { kind: "ship"; item: VaultItemView } | null;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Decide",
  HELD: "Held for shipping",
  SOLD: "Sold back",
  SHIP_REQUESTED: "Shipping requested",
  SHIPPED: "Shipped",
};

export function VaultList({ items, isDemo, buybackPercent, shippingFeeCents, defaultAction, windowDays }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "danger"; text: string } | null>(null);

  const open = items.filter((i) => i.status === "PENDING" || i.status === "HELD");
  const closed = items.filter((i) => !(i.status === "PENDING" || i.status === "HELD"));

  const done = (text: string) => {
    setDialog(null);
    setNotice({ kind: "success", text });
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Awaiting your decision ({open.length})</h2>
        <p className="text-sm text-muted">
          You have {windowDays} days per item to ship it or sell it back for {buybackPercent}% of its listed value.
          If you do nothing, {defaultAction === "AUTO_SELL" ? "it is sold back automatically" : "it is held for shipping until you add an address"}.
        </p>
        {open.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">
            Nothing waiting. <Link href="/" className="text-accent underline">Spin a wheel</Link> to win something.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {open.map((item) => (
              <li key={item.id} className="card flex gap-4 p-4">
                <Image src={item.product.imageUrl ?? "/placeholder-product.svg"} alt="" width={96} height={96} unoptimized className="h-24 w-24 shrink-0 rounded-xl border border-border object-cover" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="truncate font-semibold">{item.product.name}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <TierBadge rarity={item.spin.tier.rarity} name={item.spin.tier.name} />
                      <span>{item.spin.wheel.name}</span>
                      <span className="font-mono text-text">{formatCents(item.valueCents, { compact: true })}</span>
                    </p>
                  </div>
                  <p className="text-xs">
                    {item.status === "HELD" ? (
                      <span className="text-warning">Held for shipping: add an address when ready</span>
                    ) : item.expiresAt ? (
                      <Countdown until={item.expiresAt.toString()} />
                    ) : null}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => setDialog({ kind: "ship", item })}>
                      Ship it
                    </button>
                    <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setDialog({ kind: "sell", item })}>
                      Sell for {formatCents(Math.round((item.valueCents * buybackPercent) / 100), { compact: true })}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">History</h2>
          <ul className="card divide-y divide-border">
            {closed.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="badge border border-border bg-surface-2">{STATUS_LABEL[item.status] ?? item.status}</span>
                <span className="min-w-0 flex-1 truncate">{item.product.name}</span>
                {item.status === "SOLD" && item.buybackCents != null && (
                  <span className="font-mono text-success">+{formatCents(item.buybackCents)}{item.autoDecided ? " (auto)" : ""}</span>
                )}
                {item.order && (
                  <span className="text-xs text-muted">
                    Order {item.order.status.toLowerCase()}
                    {item.order.trackingNumber && <> · {item.order.carrier} {item.order.trackingNumber}</>}
                  </span>
                )}
                <span className="text-xs text-muted">{new Date(item.decidedAt ?? item.createdAt).toLocaleDateString("en-US")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog?.kind === "sell" && (
        <SellDialog item={dialog.item} buybackPercent={buybackPercent} isDemo={isDemo} onClose={() => setDialog(null)} onDone={done} onError={(t) => setNotice({ kind: "danger", text: t })} />
      )}
      {dialog?.kind === "ship" && (
        <ShipDialog item={dialog.item} isDemo={isDemo} shippingFeeCents={shippingFeeCents} onClose={() => setDialog(null)} onDone={done} />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useFocusTrap<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function SellDialog({ item, buybackPercent, isDemo, onClose, onDone, onError }: { item: VaultItemView; buybackPercent: number; isDemo: boolean; onClose: () => void; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const quote = Math.round((item.valueCents * buybackPercent) / 100);
  const confirm = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/vault/${item.id}/sell`, { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message ?? "Could not sell");
      onDone(`Sold ${item.product.name} for ${formatCents(body.buybackCents)}. New balance ${formatCents(body.balanceAfterCents)}.`);
    } catch (e) {
      onClose();
      onError(e instanceof Error ? e.message : "Could not sell");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Sell back to HonshuWheel" onClose={onClose}>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Item</dt><dd className="text-right">{item.product.name}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Listed value</dt><dd className="font-mono">{formatCents(item.valueCents)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Buyback rate</dt><dd className="font-mono">{buybackPercent}%</dd></div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>You receive</dt><dd className="font-mono text-success">{formatCents(quote)}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-muted">
        Credited to your {isDemo ? "demo" : "account"} balance immediately. This cannot be undone.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" onClick={confirm} disabled={busy}>{busy ? "Selling…" : `Confirm sale for ${formatCents(quote)}`}</button>
      </div>
    </Modal>
  );
}

function ShipDialog({ item, isDemo, shippingFeeCents, onClose, onDone }: { item: VaultItemView; isDemo: boolean; shippingFeeCents: number; onClose: () => void; onDone: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ recipientName: "", line1: "", line2: "", city: "", state: "", postalCode: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const disabled = isDemo || item.isDemo;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/vault/${item.id}/ship`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message ?? "Could not request shipping");
      onDone(`Shipping requested for ${item.product.name}. We'll add tracking once it ships.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request shipping");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Ship this item" onClose={onClose}>
      {disabled ? (
        <div className="mt-4 space-y-4">
          <Alert kind="warning">
            {isDemo
              ? "Shipping is disabled while the site is in demo mode. Items won with demo credits can be sold back for demo credits."
              : "This item was won with demo credits and cannot be shipped."}
          </Alert>
          <div className="flex justify-end"><button type="button" className="btn-secondary" onClick={onClose}>Close</button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm" noValidate>
          <p className="text-muted">A flat shipping fee of <span className="font-mono text-text">{formatCents(shippingFeeCents)}</span> is charged to your balance.</p>
          {error && <Alert kind="danger">{error}</Alert>}
          <input className="input" placeholder="Recipient name" aria-label="Recipient name" value={f.recipientName} onChange={set("recipientName")} required />
          <input className="input" placeholder="Street address" aria-label="Street address" value={f.line1} onChange={set("line1")} required />
          <input className="input" placeholder="Apt, suite (optional)" aria-label="Address line 2" value={f.line2} onChange={set("line2")} />
          <div className="grid grid-cols-[1fr_6rem_7rem] gap-2">
            <input className="input" placeholder="City" aria-label="City" value={f.city} onChange={set("city")} required />
            <select className="input" aria-label="State" value={f.state} onChange={set("state")} required>
              <option value="">State</option>
              {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
            </select>
            <input className="input" placeholder="ZIP" aria-label="ZIP code" inputMode="numeric" value={f.postalCode} onChange={set("postalCode")} required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Requesting…" : `Request shipping (${formatCents(shippingFeeCents)})`}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
