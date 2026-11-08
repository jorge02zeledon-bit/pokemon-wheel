import type { VaultItem } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { getSettings, type Settings } from "../settings";
import { applyLedgerEntry } from "../wallet/ledger";
import { requireRealMoney, ForbiddenError } from "../errors";
import { ValidationError } from "../engine/errors";
import { percentOfCents } from "@/lib/money";
import type { ShippingAddress } from "@/lib/validation/address";

/**
 * Vault decisions: what a user does with a won item.
 *
 *  - sell back: credit `buybackPercent` of the item's value (at win time) to
 *    the balance the item was won with (demo or real); status SOLD.
 *  - ship: real-money mode only, real items only. Charges the flat shipping
 *    fee from the real balance and creates an Order for admin fulfilment;
 *    status SHIP_REQUESTED.
 *
 * Both run in a transaction with the vault row locked, so double submits and
 * races with the expiry job resolve to exactly one outcome.
 */

export class VaultItemUnavailableError extends Error {
  constructor(message = "This item can no longer be changed") {
    super(message);
    this.name = "VaultItemUnavailableError";
  }
}

/** Statuses from which the user may still make a decision. */
const DECIDABLE = new Set(["PENDING", "HELD"]);

export function buybackQuoteCents(valueCents: number, settings: Pick<Settings, "buybackPercent">): number {
  return percentOfCents(valueCents, settings.buybackPercent);
}

async function lockItem(tx: Tx, vaultItemId: string, userId: string | null): Promise<VaultItem> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "VaultItem" WHERE "id" = ${vaultItemId} FOR UPDATE`;
  if (rows.length !== 1) throw new VaultItemUnavailableError("Item not found");
  const item = await tx.vaultItem.findUniqueOrThrow({ where: { id: vaultItemId } });
  if (userId && item.userId !== userId) throw new ForbiddenError("This item is not in your vault");
  if (!DECIDABLE.has(item.status)) throw new VaultItemUnavailableError(`This item has already been ${item.status.toLowerCase().replace("_", " ")}`);
  return item;
}

/** Core sell-back used by both the user action and the expiry job. */
export async function sellBackInTx(tx: Tx, item: VaultItem, settings: Settings, auto: boolean) {
  const buybackCents = buybackQuoteCents(item.valueCents, settings);
  const entry = await applyLedgerEntry(tx, {
    userId: item.userId,
    type: "BUYBACK",
    amountCents: buybackCents,
    isDemo: item.isDemo,
    referenceType: "VAULT_ITEM",
    referenceId: item.id,
    description: `${auto ? "Automatic buyback" : "Buyback"} (${settings.buybackPercent}% of listed value)`,
  });
  const updated = await tx.vaultItem.update({
    where: { id: item.id },
    data: { status: "SOLD", buybackCents, decidedAt: new Date(), autoDecided: auto, expiresAt: null },
  });
  return { item: updated, buybackCents, balanceAfterCents: entry.balanceAfterCents };
}

export async function sellBack(userId: string, vaultItemId: string) {
  const settings = await getSettings();
  return prisma.$transaction(async (tx) => {
    const item = await lockItem(tx, vaultItemId, userId);
    return sellBackInTx(tx, item, settings, false);
  });
}

export async function requestShipping(userId: string, vaultItemId: string, address: ShippingAddress) {
  // Hard server-side gate: no shipping in demo mode, whatever the UI shows.
  requireRealMoney();
  const settings = await getSettings();
  return prisma.$transaction(async (tx) => {
    const item = await lockItem(tx, vaultItemId, userId);
    if (item.isDemo) throw new ValidationError("Items won with demo credits cannot be shipped");

    const fee = settings.shippingFeeCents;
    const entry =
      fee > 0
        ? await applyLedgerEntry(tx, {
            userId,
            type: "SHIPPING_FEE",
            amountCents: -fee,
            isDemo: false,
            referenceType: "VAULT_ITEM",
            referenceId: item.id,
            description: "Flat shipping fee",
          })
        : null;

    const order = await tx.order.create({
      data: {
        userId,
        status: "REQUESTED",
        shippingFeeCents: fee,
        recipientName: address.recipientName,
        line1: address.line1,
        line2: address.line2 ?? null,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: "US",
      },
    });
    const updated = await tx.vaultItem.update({
      where: { id: item.id },
      data: { status: "SHIP_REQUESTED", orderId: order.id, decidedAt: new Date(), expiresAt: null },
    });
    return { item: updated, order, feeCents: fee, balanceAfterCents: entry?.balanceAfterCents ?? null };
  });
}
