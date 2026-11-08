import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/server/providers/payment";
import { settleDeposit } from "@/server/wallet/deposits";
import { finalizeWithdrawal } from "@/server/wallet/withdrawals";
import { prisma } from "@/server/db";

/** POST /api/webhooks/payment: processor callbacks. Signature verification lives in the provider. */
export async function POST(req: Request) {
  try {
    const ev = await getPaymentProvider().parseWebhook(req);
    if (ev) {
      if (ev.kind === "deposit") {
        const dep = await prisma.deposit.findFirst({ where: { providerRef: ev.providerRef } });
        if (dep) await settleDeposit(dep.id, ev.status);
      } else {
        const w = await prisma.withdrawal.findFirst({ where: { providerRef: ev.providerRef } });
        if (w) await finalizeWithdrawal(w.id, ev.status);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("payment webhook rejected", e);
    return NextResponse.json({ error: "BAD_WEBHOOK" }, { status: 400 });
  }
}
