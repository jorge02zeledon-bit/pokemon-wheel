import { NextResponse } from "next/server";
import { getIdentityProvider } from "@/server/providers/identity";
import { applyVerificationUpdate } from "@/server/compliance/identity";

/**
 * POST /api/webhooks/identity: inbound status updates from the KYC vendor.
 * The provider implementation is responsible for verifying the signature and
 * must throw on a bad one, which we answer with 400.
 */
export async function POST(req: Request) {
  try {
    const update = await getIdentityProvider().parseWebhook(req);
    if (update) await applyVerificationUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("identity webhook rejected", e);
    return NextResponse.json({ error: "BAD_WEBHOOK" }, { status: 400 });
  }
}
